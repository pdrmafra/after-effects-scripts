(function depthMapStaticTool() {
    var SCRIPT_FILE = new File($.fileName);
    var SCRIPT_DIR = SCRIPT_FILE.parent;
    var PROJECT_DIR = SCRIPT_DIR.parent;
    var BACKEND_SCRIPT = new File(PROJECT_DIR.fsName + "/backend/generate_depth.py");
    var VDA_SEQUENCE_BACKEND_SCRIPT = new File(PROJECT_DIR.fsName + "/backend/generate_vda_sequence.py");
    var VENV_PYTHON = new File(PROJECT_DIR.fsName + "/backend/.venv/bin/python");
    var OUTPUT_ROOT = null;
    var ENCODER = "vits";
    var QUALITY_LABELS = ["Normal", "High (slower)"];
    var QUALITY_INPUT_SIZES = [518, 1022];
    // Video Depth Anything on Apple GPUs failed above ~644 px (one buffer of 64 GB at 1022), so sequences stay at Normal.
    var SEQUENCE_INPUT_SIZE = 518;
    var STILL_EXTENSIONS = /\.(png|jpe?g|tiff?|bmp|webp)$/i;
    var MAX_SEQUENCE_FRAMES = 300;
    var PROJECT_FOLDER_NAME = "Depth Maps";
    var EFFECT_LABELS = ["None", "Depth Reveal", "Depth Sweep", "Parallax (stills only)"];
    var EFFECT_KINDS = ["none", "reveal", "sweep", "parallax"];
    var REVEAL_SECONDS = 1;
    var SWEEP_SECONDS = 1.5;
    var SWEEP_WIDTH = 12;         // band width, in percent of the depth range
    var PARALLAX_SECONDS = 3;
    var PARALLAX_AMOUNT = 0.015;  // displacement at each end of the move, as a fraction of the image width  // Project panel folder for everything this tool imports
    var TICK_MS = 150;            // how often a running job is checked; AE stays responsive in between
    var EXPORT_SLICE_MS = 250;    // frame export work done per check
    var FRAME_TIMEOUT_MS = 10000;
    var STOP_TIMEOUT_MS = 5000;   // after Cancel, force-stop Python if it has not exited by then

    function shellQuote(value) {
        return "'" + String(value).replace(/'/g, "'\\''") + "'";
    }

    function getActiveComp() {
        var comp = app.project && app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) {
            return null;
        }
        return comp;
    }

    // False once the item/layer was deleted or its project closed.
    function isAlive(object) {
        try {
            return !!object && object.name !== undefined;
        } catch (err) {
            return false;
        }
    }

    function isStillFootageLayer(layer) {
        var source = layer && layer.source;
        return !!(source && source instanceof FootageItem && source.mainSource instanceof FileSource && source.mainSource.isStill);
    }

    // What one click does with the current selection:
    // every selected layer is a still image -> one depth image per layer;
    // nothing selected or anything else -> a depth sequence of the comp work area.
    function planFromSelection(comp) {
        var layers = comp.selectedLayers;
        var stills = [];
        var i;

        if (layers.length === 0) {
            return { mode: "sequence" };
        }

        for (i = 0; i < layers.length; i += 1) {
            if (isStillFootageLayer(layers[i])) {
                stills.push(layers[i]);
            }
        }

        if (stills.length === 0) {
            return { mode: "sequence" };
        }

        if (stills.length !== layers.length) {
            return { error: "Select only still images (one depth map each), or deselect everything to generate the work area as a sequence." };
        }

        for (i = 0; i < stills.length; i += 1) {
            if (!stills[i].source.file || !stills[i].source.file.exists) {
                return { error: "The image file for layer \"" + stills[i].name + "\" is missing. Relink the footage first." };
            }
            if (!STILL_EXTENSIONS.test(stills[i].source.file.name)) {
                return { error: "Layer \"" + stills[i].name + "\" uses a file type the model cannot read. Use PNG, JPEG or TIFF." };
            }
        }

        return { mode: "still", layers: stills };
    }

    // Files always go into a "Depth Maps" folder on disk: next to the saved .aep (no dialog), or, for an unsaved
    // project, inside a folder chosen once per session (a chosen folder already named "Depth Maps" is used as is).
    function depthMapsFolderIn(folder) {
        return folder.name === PROJECT_FOLDER_NAME ? folder : new Folder(folder.fsName + "/" + PROJECT_FOLDER_NAME);
    }

    function chooseOutputFolder() {
        var projectFile = app.project.file;
        var picked;

        if (projectFile) {
            OUTPUT_ROOT = depthMapsFolderIn(projectFile.parent);
        } else if (!OUTPUT_ROOT || !OUTPUT_ROOT.exists) {
            picked = Folder.selectDialog("The project is not saved yet. Choose where to create the \"Depth Maps\" folder");
            if (!picked) {
                return false;
            }
            OUTPUT_ROOT = depthMapsFolderIn(picked);
        }

        if (!OUTPUT_ROOT.exists && !OUTPUT_ROOT.create()) {
            alert("Could not create the output folder:\n" + OUTPUT_ROOT.fsName);
            OUTPUT_ROOT = null;
            return false;
        }
        return true;
    }

    function uniqueStamp() {
        return String(new Date().getTime()) + "_" + String(Math.floor(Math.random() * 1000000));
    }

    // Short stable hash (djb2) used to name cached depth maps.
    function stringHash(text) {
        var hash = 5381;
        var i;
        for (i = 0; i < text.length; i += 1) {
            hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
        }
        return ("0000000" + hash.toString(16)).slice(-8);
    }

    // The depth map for this image at this quality always gets the same name, so it can be found and reused.
    // Editing or replacing the image (date or size changes), or another quality/model, gives a new name.
    function cachedDepthFile(inputFile, inputSize) {
        var modified = inputFile.modified ? inputFile.modified.getTime() : 0;
        var key = [inputFile.fsName, modified, inputFile.length, inputSize, ENCODER].join("|");
        var base = inputFile.displayName.replace(/\.[^\.]+$/, "");
        return new File(OUTPUT_ROOT.fsName + "/" + base + "_depth_" + String(inputSize) + "_" + stringHash(key) + ".png");
    }

    function sanitizeName(value) {
        return String(value || "comp").replace(/[^A-Za-z0-9_-]+/g, "_");
    }

    function padNumber(value, width) {
        var text = String(value);
        while (text.length < width) {
            text = "0" + text;
        }
        return text;
    }

    function makeSequenceFolders(comp) {
        var root = new Folder(OUTPUT_ROOT.fsName + "/" + sanitizeName(comp.name) + "_" + uniqueStamp());
        var sourceFolder = new Folder(root.fsName + "/source");
        var depthFolder = new Folder(root.fsName + "/depth");

        if (!root.create() || !sourceFolder.create() || !depthFolder.create()) {
            throw new Error("Could not create sequence output folders.");
        }

        return {
            root: root,
            source: sourceFolder,
            depth: depthFolder,
            log: new File(root.fsName + "/sequence_log.txt")
        };
    }

    function appendLog(logFile, message) {
        if (!logFile) {
            return;
        }

        try {
            logFile.open("a");
            logFile.writeln(new Date().toUTCString() + " " + message);
            logFile.close();
        } catch (err) {
            try {
                logFile.close();
            } catch (closeErr) {}
        }
    }

    function readText(file) {
        var text = "";
        if (!file || !file.exists) {
            return "";
        }
        try {
            file.open("r");
            text = file.read();
        } catch (err) {
            text = "";
        }
        try {
            file.close();
        } catch (closeErr) {}
        return text;
    }

    function lastLines(text, count) {
        var lines = String(text).replace(/\r/g, "\n").split("\n");
        var kept = [];
        var i;
        for (i = lines.length - 1; i >= 0 && kept.length < count; i -= 1) {
            if (lines[i].replace(/\s+/g, "") !== "") {
                kept.unshift(lines[i]);
            }
        }
        return kept.join("\n");
    }

    // Deletes a file or a folder this tool created for one run (never anything else).
    function removeTree(item) {
        var children;
        var i;

        if (!item || !item.exists) {
            return;
        }
        if (item instanceof Folder) {
            children = item.getFiles();
            for (i = 0; i < children.length; i += 1) {
                removeTree(children[i]);
            }
        }
        item.remove();
    }

    // ---- Background Python process -------------------------------------------------------------

    // Starts the command detached from After Effects and returns its process id.
    function buildLaunchCommand(command, logFile) {
        return "nohup " + command + " > " + shellQuote(logFile.fsName) + " 2>&1 < /dev/null & echo $!";
    }

    function launchBackground(command, logFile) {
        var output = system.callSystem(buildLaunchCommand(command, logFile));
        var pid = parseInt(String(output).replace(/\s+/g, ""), 10);
        if (!(pid > 0)) {
            throw new Error("Could not start Python.\n\nCommand:\n" + command + "\n\nOutput:\n" + output);
        }
        return pid;
    }

    function isProcessRunning(pid) {
        return String(system.callSystem("kill -0 " + String(pid) + " 2>/dev/null && echo running")).indexOf("running") >= 0;
    }

    function stopProcess(pid, force) {
        system.callSystem("kill " + (force ? "-9 " : "") + String(pid) + " 2>/dev/null");
    }

    // Reads Video Depth Anything's log: model blocks ("2/5 [") then written frames ("40/96 /path").
    function parseSequenceProgress(logText) {
        var text = String(logText).replace(/\r/g, "\n");
        var writing = text.match(/^(\d+)\/(\d+) \//gm);
        var blocks = text.match(/(\d+)\/(\d+) \[/g);
        var parts;

        if (writing) {
            parts = writing[writing.length - 1].match(/(\d+)\/(\d+)/);
            return { phase: "writing", done: Number(parts[1]), total: Number(parts[2]) };
        }
        if (blocks) {
            parts = blocks[blocks.length - 1].match(/(\d+)\/(\d+)/);
            return { phase: "model", done: Number(parts[1]), total: Number(parts[2]) };
        }
        return { phase: "starting", done: 0, total: 0 };
    }

    // ---- Commands ------------------------------------------------------------------------------

    function buildCommand(inputFile, outputFile, options) {
        var args = [];

        args.push(shellQuote(BACKEND_SCRIPT.fsName));
        args.push("--input " + shellQuote(inputFile.fsName));
        args.push("--output " + shellQuote(outputFile.fsName));
        args.push("--encoder " + shellQuote(ENCODER));
        args.push("--input-size " + String(options.inputSize));
        args.push("--device auto");

        return shellQuote(VENV_PYTHON.fsName) + " " + args.join(" ");
    }

    function buildSequenceCommand(inputFolder, outputFolder, options, fps) {
        var args = [];

        args.push(shellQuote(VDA_SEQUENCE_BACKEND_SCRIPT.fsName));
        args.push("--input-dir " + shellQuote(inputFolder.fsName));
        args.push("--output-dir " + shellQuote(outputFolder.fsName));
        args.push("--pattern " + shellQuote("frame_*.png"));
        args.push("--prefix " + shellQuote("vda_depth_"));
        args.push("--encoder " + shellQuote(ENCODER));
        args.push("--input-size " + String(options.inputSize));
        args.push("--device auto");
        args.push("--fps " + String(fps));

        return shellQuote(VENV_PYTHON.fsName) + " " + args.join(" ");
    }

    function getCheckpointFile() {
        return new File(PROJECT_DIR.fsName + "/backend/vendor/Depth-Anything-V2/checkpoints/depth_anything_v2_" + ENCODER + ".pth");
    }

    function getVdaCheckpointFile() {
        return new File(PROJECT_DIR.fsName + "/backend/vendor/Video-Depth-Anything/checkpoints/video_depth_anything_" + ENCODER + ".pth");
    }

    // Returns an error message, or "" when the backend and the needed checkpoint are installed.
    function checkSetup(mode) {
        var checkpointFile = mode === "still" ? getCheckpointFile() : getVdaCheckpointFile();
        var backendFile = mode === "still" ? BACKEND_SCRIPT : VDA_SEQUENCE_BACKEND_SCRIPT;

        if ($.os.indexOf("Mac") < 0) {
            return "The AE launcher currently supports macOS only. See README for CLI usage.";
        }
        if (!VENV_PYTHON.exists) {
            return "Python environment not installed. Follow depth-map/README.md before using this panel.";
        }
        if (!backendFile.exists) {
            return "Backend script not found: " + backendFile.fsName;
        }
        if (!checkpointFile.exists) {
            return "Model not installed. No weights are bundled; download it separately (see README).\n\nExpected file:\n" + checkpointFile.fsName;
        }
        return "";
    }

    // ---- Import --------------------------------------------------------------------------------

    // The "Depth Maps" folder at the top of the Project panel; created on first use, reused afterwards.
    function getProjectFolder() {
        var root = app.project.rootFolder;
        var i;

        for (i = 1; i <= root.numItems; i += 1) {
            if (root.item(i) instanceof FolderItem && root.item(i).name === PROJECT_FOLDER_NAME) {
                return root.item(i);
            }
        }
        return app.project.items.addFolder(PROJECT_FOLDER_NAME);
    }

    function clearProperty(property) {
        if (!property) {
            return;
        }
        if (property.canSetExpression && property.expression !== "") {
            property.expression = "";
        }
        while (property.numKeys > 0) {
            property.removeKey(property.numKeys);
        }
    }

    // Parents the depth layer to its image with a neutral transform, so it sits exactly on the image
    // (same pixel size) and follows every later change to it.
    function followSourceLayer(layer, sourceLayer, width, height) {
        var transform = layer.property("ADBE Transform Group");
        var position = transform.property("ADBE Position");
        var names = ["ADBE Anchor Point", "ADBE Position", "ADBE Position_0", "ADBE Position_1", "ADBE Position_2", "ADBE Scale", "ADBE Orientation", "ADBE Rotate X", "ADBE Rotate Y", "ADBE Rotate Z"];
        var i;

        for (i = 0; i < names.length; i += 1) {
            clearProperty(transform.property(names[i]));
        }
        if (position.dimensionsSeparated) {
            position.dimensionsSeparated = false;
        }

        layer.parent = sourceLayer;
        transform.property("ADBE Anchor Point").setValue([width / 2, height / 2, 0]);
        position.setValue([width / 2, height / 2, 0]);
        transform.property("ADBE Scale").setValue([100, 100, 100]);
        transform.property("ADBE Rotate Z").setValue(0);
        if (layer.threeDLayer) {
            transform.property("ADBE Orientation").setValue([0, 0, 0]);
            transform.property("ADBE Rotate X").setValue(0);
            transform.property("ADBE Rotate Y").setValue(0);
        }
    }

    // Adds a white solid layer whose source lives in the Depth Maps project folder. After Effects files new solids
    // in a "Solids" folder (named in the AE language) and creates it if needed; if it was created just now and ends up
    // empty, it is removed so the user's project gains only the Depth Maps folder.
    function addOwnSolid(comp, name, width, height, pixelAspect) {
        var root = app.project.rootFolder;
        var existing = {};
        var layer;
        var solidsFolder;
        var i;

        for (i = 1; i <= root.numItems; i += 1) {
            existing[root.item(i).id] = true;
        }
        layer = comp.layers.addSolid([1, 1, 1], name, width, height, pixelAspect, comp.duration);
        solidsFolder = layer.source.parentFolder;
        layer.source.parentFolder = getProjectFolder();
        if (solidsFolder && solidsFolder !== root && !existing[solidsFolder.id] && solidsFolder.numItems === 0) {
            solidsFolder.remove();
        }
        return layer;
    }

    // The project item already using this file, if the depth map was imported before.
    function findFootage(file) {
        var items = app.project.items;
        var i;
        for (i = 1; i <= items.length; i += 1) {
            if (items[i] instanceof FootageItem && items[i].file && items[i].file.fsName === file.fsName) {
                return items[i];
            }
        }
        return null;
    }

    // Imports the depth image. With a source layer, it duplicates that layer (same timing, 3D switch and place
    // in the stack), swaps in the depth image, removes effects so they do not alter the depth values,
    // and parents it to the image. If the image layer was deleted meanwhile, the depth goes on top of the comp.
    function importDepthMap(depthFile, comp, sourceLayer, importAsGuideLayer) {
        var footage;
        var layer;
        var effects;
        var i;

        if (!depthFile.exists) {
            throw new Error("Depth map was not created: " + depthFile.fsName);
        }

        footage = findFootage(depthFile);
        if (footage) {
            footage.mainSource.reload();  // picks up a regenerated file with the same name
        } else {
            footage = app.project.importFile(new ImportOptions(depthFile));
            footage.name = depthFile.displayName;
            footage.parentFolder = getProjectFolder();
        }

        if (comp) {
            if (sourceLayer && isAlive(sourceLayer)) {
                layer = sourceLayer.duplicate();
                layer.locked = false;
                layer.replaceSource(footage, false);
                effects = layer.property("ADBE Effect Parade");
                for (i = effects.numProperties; i >= 1; i -= 1) {
                    effects.property(i).remove();
                }
                layer.blendingMode = BlendingMode.NORMAL;
                layer.enabled = true;
                followSourceLayer(layer, sourceLayer, footage.width, footage.height);
            } else {
                layer = comp.layers.add(footage);
            }
            layer.name = footage.name;
            layer.guideLayer = !!importAsGuideLayer;
        }

        return layer;
    }

    function importDepthSequence(firstFrameFile, comp, importAsGuideLayer, startTime) {
        var importOptions;
        var footage;
        var layer;

        if (!firstFrameFile.exists) {
            throw new Error("Depth sequence first frame was not created: " + firstFrameFile.fsName);
        }

        importOptions = new ImportOptions(firstFrameFile);
        importOptions.sequence = true;
        importOptions.forceAlphabetical = true;
        footage = app.project.importFile(importOptions);
        footage.name = comp.name + "_depth_sequence";
        footage.parentFolder = getProjectFolder();

        footage.mainSource.conformFrameRate = 1 / comp.frameDuration;

        layer = comp.layers.add(footage);
        layer.name = footage.name;
        layer.startTime = startTime;
        layer.guideLayer = !!importAsGuideLayer;

        return layer;
    }

    // ---- Effects driven by the depth layer -----------------------------------------------------

    function addEffect(layer, matchName, displayName) {
        var effects = layer.property("ADBE Effect Parade");
        return effects.canAddProperty(matchName) ? effects.addProperty(matchName) : effects.addProperty(displayName);
    }

    // Percent controls are 0..100 on screen but some (like Transition Softness) are 0..1 to scripts.
    function percentValue(property, percent) {
        return property.hasMax && property.maxValue <= 1 ? percent / 100 : percent;
    }

    function easeKeys(property) {
        var i;
        for (i = 1; i <= property.numKeys; i += 1) {
            property.setTemporalEaseAtKey(i, [new KeyframeEase(0, 33.33)], [new KeyframeEase(0, 33.33)]);
        }
    }

    // The depth layer becomes a hidden control layer: effects read it, it does not render itself.
    function useAsControlLayer(depthLayer) {
        depthLayer.enabled = false;
        depthLayer.guideLayer = false;
    }

    // Gradient Wipe driven by depth: near (bright) areas appear first. Invert Gradient makes the background lead.
    function applyDepthReveal(targetLayer, depthLayer, startTime, frameDuration) {
        var wipe = addEffect(targetLayer, "ADBE Gradient Wipe", "Gradient Wipe");
        var completion = wipe.property(1);
        var endTime = startTime + Math.round(REVEAL_SECONDS / frameDuration) * frameDuration;

        wipe.name = "Depth Reveal";
        wipe.property(2).setValue(percentValue(wipe.property(2), 25)); // Transition Softness
        wipe.property(3).setValue(depthLayer.index); // Gradient Layer
        wipe.property(4).setValue(3);               // Gradient Placement: Stretch Gradient to Fit
        completion.setValueAtTime(startTime, percentValue(completion, 100));
        completion.setValueAtTime(endTime, 0);
        easeKeys(completion);
        useAsControlLayer(depthLayer);
    }

    // Displacement Map driven by depth: near and far move in opposite directions, like a small camera orbit.
    function applyParallax(targetLayer, depthLayer, startTime, frameDuration, imageWidth) {
        var displace = addEffect(targetLayer, "ADBE Displacement Map", "Displacement Map");
        var horizontal = displace.property(3);
        var amount = Math.max(2, Math.round(imageWidth * PARALLAX_AMOUNT));
        var endTime = startTime + Math.round(PARALLAX_SECONDS / frameDuration) * frameDuration;

        displace.name = "Depth Parallax";
        displace.property(1).setValue(depthLayer.index); // Displacement Map Layer (red = green = depth)
        displace.property(5).setValue(0);                // Max Vertical Displacement
        displace.property(6).setValue(2);                // Displacement Map Behavior: Stretch Map to Fit
        horizontal.setValueAtTime(startTime, -amount);
        horizontal.setValueAtTime(endTime, amount);
        easeKeys(horizontal);
        useAsControlLayer(depthLayer);
    }

    // Depth Sweep: a white band travels from near to far. Two Gradient Wipes on a solid keep only the depth band
    // between "Sweep Front" and Front + "Sweep Width"; Add blending makes it read as light.
    // With an image layer the solid matches the image and is parented to it; otherwise it covers the comp.
    function addSweepLayer(comp, depthLayer, imageLayer, width, height, startTime) {
        var duration = Math.round(SWEEP_SECONDS / comp.frameDuration) * comp.frameDuration;
        var sweep = addOwnSolid(comp, "Depth Sweep", width, height, 1);
        var front;
        var back;
        var bandWidth;
        var opacity;
        var effects;
        var wipe;
        var i;

        sweep.blendingMode = BlendingMode.ADD;
        if (imageLayer) {
            sweep.moveBefore(depthLayer);
            sweep.threeDLayer = imageLayer.threeDLayer;
            followSourceLayer(sweep, imageLayer, width, height);
        } else {
            sweep.moveToBeginning();
        }
        sweep.inPoint = startTime;
        sweep.outPoint = startTime + duration;

        // Adding an effect invalidates references to the layer's other effects, so add and name all three first,
        // then look them up again by name.
        addEffect(sweep, "ADBE Slider Control", "Slider Control").name = "Sweep Width";
        addEffect(sweep, "ADBE Gradient Wipe", "Gradient Wipe").name = "Sweep Front";
        addEffect(sweep, "ADBE Gradient Wipe", "Gradient Wipe").name = "Sweep Back";
        effects = sweep.property("ADBE Effect Parade");
        bandWidth = effects.property("Sweep Width");
        front = effects.property("Sweep Front");
        back = effects.property("Sweep Back");

        bandWidth.property(1).setValue(SWEEP_WIDTH);
        for (i = 0; i < 2; i += 1) {
            wipe = i === 0 ? front : back;
            wipe.property(2).setValue(percentValue(wipe.property(2), 10));
            wipe.property(3).setValue(depthLayer.index);
            wipe.property(4).setValue(3);
        }
        back.property(5).setValue(1); // Invert Gradient: removes everything nearer than the band
        front.property(1).setValueAtTime(startTime, percentValue(front.property(1), 100));
        front.property(1).setValueAtTime(startTime + duration, 0);
        easeKeys(front.property(1));
        back.property(1).expression = "clamp(100 - effect(\"Sweep Front\")(1) - effect(\"Sweep Width\")(1), 0, 100)";

        opacity = sweep.property("ADBE Transform Group").property("ADBE Opacity");
        opacity.setValueAtTime(startTime + duration - 6 * comp.frameDuration, 100);
        opacity.setValueAtTime(startTime + duration, 0);
        useAsControlLayer(depthLayer);
        return sweep;
    }

    // Sequences: the reveal goes on an adjustment layer above everything, spanning the work area.
    function addRevealAdjustmentLayer(comp, depthLayer, startTime, duration) {
        var adjustment = addOwnSolid(comp, "Depth Reveal", comp.width, comp.height, comp.pixelAspect);
        adjustment.adjustmentLayer = true;
        adjustment.moveToBeginning();
        adjustment.inPoint = startTime;
        adjustment.outPoint = startTime + duration;
        applyDepthReveal(adjustment, depthLayer, startTime, comp.frameDuration);
        return adjustment;
    }

    // ---- Jobs ----------------------------------------------------------------------------------
    // A job advances in small steps (tick) so After Effects stays responsive and Cancel works.
    // report(text, fraction 0..1) shows progress; tick() returns false once the job has finished.
    // The finished job has job.result = { status: "done" | "cancelled" | "error", message }.

    // partial: the comp was already being changed when it failed, so Undo is needed to clean up.
    function finishJob(job, status, message, partial) {
        job.state = "finished";
        job.result = { status: status, message: message, partial: !!partial };
    }

    // Shared Cancel: stop Python, wait until it has exited, then delete this run's files.
    function cancelStep(job) {
        if (job.pid && isProcessRunning(job.pid)) {
            if (!job.stopRequested) {
                stopProcess(job.pid, false);
                job.stopRequested = new Date().getTime();
            } else if (new Date().getTime() - job.stopRequested > STOP_TIMEOUT_MS) {
                stopProcess(job.pid, true);
            }
            job.report("Cancelling...", job.fraction || 0);
            return true;
        }
        job.removeRunFiles();
        finishJob(job, "cancelled", "Cancelled. Nothing was imported.");
        return false;
    }

    // Adds the chosen effect to the image layer, driven by its new depth layer.
    function applyStillEffect(options, imageLayer, depthLayer, comp) {
        if (options.effect === "none" || !isAlive(imageLayer) || depthLayer.parent !== imageLayer) {
            return;
        }
        if (options.effect === "reveal") {
            applyDepthReveal(imageLayer, depthLayer, options.effectTime, comp.frameDuration);
        } else if (options.effect === "sweep") {
            addSweepLayer(comp, depthLayer, imageLayer, depthLayer.source.width, depthLayer.source.height, options.effectTime);
        } else if (options.effect === "parallax") {
            applyParallax(imageLayer, depthLayer, options.effectTime, comp.frameDuration, depthLayer.source.width);
        }
    }

    function createStillJob(comp, layers, options, report) {
        var job = { state: "launch", index: 0, outputs: [], pid: 0, report: report, fraction: 0 };
        var current = null;

        function stillName(i) {
            return layers.length === 1 ? "Generating depth map..." : "Generating depth map " + String(i + 1) + " of " + String(layers.length) + "...";
        }

        // Never deletes reused depth maps: only files made by this run.
        job.removeRunFiles = function () {
            var i;
            if (current) {
                removeTree(current.output);
                removeTree(current.log);
            }
            for (i = 0; i < job.outputs.length; i += 1) {
                if (!job.outputs[i].reused) {
                    removeTree(job.outputs[i].output);
                }
            }
        };

        job.cancel = function () {
            if (job.state !== "finished") {
                job.state = "cancelling";
            }
        };

        job.tick = function () {
            var i;
            var footage;
            var reusedCount;

            try {
                if (job.state === "finished") {
                    return false;
                }
                if (job.state === "cancelling") {
                    return cancelStep(job);
                }
                if (!isAlive(comp)) {
                    job.cancel();
                    return true;
                }

                if (job.state === "launch") {
                    var inputFile = layers[job.index].source.file;
                    var target = cachedDepthFile(inputFile, options.inputSize);
                    if (target.exists && !options.regenerate) {
                        job.outputs.push({ output: target, layer: layers[job.index], reused: true });
                        job.index += 1;
                        job.state = job.index < layers.length ? "launch" : "import";
                        return true;
                    }
                    // A new map is written under a temporary name and only replaces the cached one when complete.
                    var stem = target.fsName.replace(/\.png$/, "") + "_new_" + uniqueStamp();
                    current = { output: new File(stem + ".png"), log: new File(stem + ".log"), target: target, layer: layers[job.index] };
                    job.pid = launchBackground(buildCommand(inputFile, current.output, options), current.log);
                    job.state = "wait";
                    job.fraction = job.index / layers.length;
                    report(stillName(job.index), job.fraction);
                    return true;
                }

                if (job.state === "wait") {
                    if (isProcessRunning(job.pid)) {
                        return true;
                    }
                    job.pid = 0;
                    if (!current.output.exists) {
                        var failure = lastLines(readText(current.log), 15);
                        removeTree(current.log);
                        current = null;
                        job.removeRunFiles();
                        finishJob(job, "error", "The model stopped with this message:\n\n" + failure);
                        return false;
                    }
                    removeTree(current.log);
                    if (current.target.exists) {
                        current.target.remove();
                    }
                    if (!current.output.rename(current.target.name)) {
                        throw new Error("Could not rename the new depth map to " + current.target.fsName);
                    }
                    current.output = current.target;
                    job.outputs.push(current);
                    current = null;
                    job.index += 1;
                    job.state = job.index < layers.length ? "launch" : "import";
                    return true;
                }

                if (job.state === "import") {
                    app.beginUndoGroup("Generate Depth Map");
                    try {
                        for (i = 0; i < job.outputs.length; i += 1) {
                            footage = importDepthMap(job.outputs[i].output, comp, job.outputs[i].layer, options.guideLayer);
                            applyStillEffect(options, job.outputs[i].layer, footage, comp);
                        }
                    } finally {
                        app.endUndoGroup();
                    }
                    report("", 1);
                    reusedCount = 0;
                    for (i = 0; i < job.outputs.length; i += 1) {
                        reusedCount += job.outputs[i].reused ? 1 : 0;
                    }
                    finishJob(job, "done", (job.outputs.length === 1 ? "Imported \"" + footage.name + "\"" : "Imported " + String(job.outputs.length) + " depth maps") + " into the Depth Maps folder." +
                        (reusedCount ? "\n\n" + (reusedCount === job.outputs.length ? (reusedCount === 1 ? "It already existed" : "They already existed") : String(reusedCount) + " already existed") + " for this image and quality, so it was reused. Option-click Generate to make a new one." : "") +
                        "\n\nFiles saved in:\n" + OUTPUT_ROOT.fsName);
                    return false;
                }
            } catch (err) {
                if (job.pid) {
                    stopProcess(job.pid, true);
                }
                finishJob(job, "error", err.toString(), job.state === "import");
                return false;
            }
            return true;
        };

        return job;
    }

    function createSequenceJob(comp, options, report) {
        var job = { state: "prepare", pid: 0, report: report, fraction: 0 };
        var folders = null;
        var frameCount = 0;
        var frameIndex = 0;
        var pendingFrame = null;
        var pendingSince = 0;
        var startTime = 0;
        var fps = 1;
        var importing = false;

        job.removeRunFiles = function () {
            if (folders) {
                removeTree(folders.root);
            }
        };

        job.cancel = function () {
            if (job.state !== "finished") {
                job.state = "cancelling";
            }
        };

        function fail(message) {
            if (folders) {
                appendLog(folders.log, "ERROR: " + message);
                message += "\n\nLog:\n" + folders.log.fsName;
            }
            finishJob(job, "error", message, importing);
            return false;
        }

        // Exports frames for a short slice of time, then hands control back to After Effects.
        function exportSlice() {
            var sliceStart = new Date().getTime();
            var frameFile;

            while (new Date().getTime() - sliceStart < EXPORT_SLICE_MS) {
                if (pendingFrame) {
                    if (!pendingFrame.exists) {
                        if (new Date().getTime() - pendingSince > FRAME_TIMEOUT_MS) {
                            throw new Error("After Effects did not export frame: " + pendingFrame.fsName);
                        }
                        $.sleep(20);
                        continue;
                    }
                    pendingFrame = null;
                    frameIndex += 1;
                }
                if (frameIndex >= frameCount) {
                    return true;
                }
                frameFile = new File(folders.source.fsName + "/frame_" + padNumber(frameIndex + 1, 6) + ".png");
                comp.saveFrameToPng(startTime + frameIndex * comp.frameDuration, frameFile);
                pendingFrame = frameFile;
                pendingSince = new Date().getTime();
            }
            return false;
        }

        job.tick = function () {
            var progress;
            var completed;
            var frames;
            var firstFrame;

            try {
                if (job.state === "finished") {
                    return false;
                }
                if (job.state === "cancelling") {
                    return cancelStep(job);
                }
                if (!isAlive(comp)) {
                    job.cancel();
                    return true;
                }

                if (job.state === "prepare") {
                    folders = makeSequenceFolders(comp);
                    startTime = comp.workAreaStart;
                    fps = 1 / comp.frameDuration;
                    frameCount = Math.max(1, Math.ceil(comp.workAreaDuration / comp.frameDuration - 0.000001));
                    appendLog(folders.log, "Starting sequence for comp: " + comp.name);
                    appendLog(folders.log, "Work area start: " + String(startTime) + ", frames: " + String(frameCount) + ", fps: " + String(fps));
                    job.state = "export";
                    return true;
                }

                if (job.state === "export") {
                    if (exportSlice()) {
                        job.state = "launch";
                    }
                    job.fraction = 0.3 * frameIndex / frameCount;
                    report("Exporting frame " + String(frameIndex) + " / " + String(frameCount), job.fraction);
                    return true;
                }

                if (job.state === "launch") {
                    var command = buildSequenceCommand(folders.source, folders.depth, options, fps);
                    appendLog(folders.log, "Running sequence command: " + command);
                    job.pid = launchBackground(command, new File(folders.root.fsName + "/model_log.txt"));
                    job.state = "wait";
                    report("Starting the depth model...", 0.3);
                    return true;
                }

                if (job.state === "wait") {
                    progress = parseSequenceProgress(readText(new File(folders.root.fsName + "/model_log.txt")));
                    if (progress.phase === "model") {
                        job.fraction = 0.3 + 0.6 * progress.done / progress.total;
                        report("Generating depth, block " + String(progress.done) + " / " + String(progress.total), job.fraction);
                    } else if (progress.phase === "writing") {
                        job.fraction = 0.9 + 0.1 * progress.done / progress.total;
                        report("Saving depth frame " + String(progress.done) + " / " + String(progress.total), job.fraction);
                    }
                    if (isProcessRunning(job.pid)) {
                        return true;
                    }
                    job.pid = 0;
                    appendLog(folders.log, "Model output:\n" + readText(new File(folders.root.fsName + "/model_log.txt")));
                    firstFrame = new File(folders.depth.fsName + "/vda_depth_frame_000001.png");
                    completed = new File(folders.depth.fsName + "/depth_complete.json");
                    frames = folders.depth.getFiles("vda_depth_frame_*.png");
                    if (!firstFrame.exists || !completed.exists || frames.length !== frameCount) {
                        return fail("The model stopped with this message:\n\n" + lastLines(readText(new File(folders.root.fsName + "/model_log.txt")), 15));
                    }
                    importing = true;
                    app.beginUndoGroup("Generate Work Area Depth Sequence");
                    try {
                        var depthLayer = importDepthSequence(firstFrame, comp, options.guideLayer, startTime);
                        if (options.effect === "reveal") {
                            addRevealAdjustmentLayer(comp, depthLayer, startTime, frameCount * comp.frameDuration);
                        } else if (options.effect === "sweep") {
                            addSweepLayer(comp, depthLayer, null, comp.width, comp.height, startTime);
                        }
                    } finally {
                        app.endUndoGroup();
                    }
                    report("", 1);
                    finishJob(job, "done", "Imported a " + String(frameCount) + "-frame sequence into the Depth Maps folder.\n\nFiles saved in:\n" + folders.depth.fsName);
                    return false;
                }
            } catch (err) {
                if (job.pid) {
                    stopProcess(job.pid, true);
                }
                return fail(err.toString());
            }
            return true;
        };

        return job;
    }

    // ---- Window --------------------------------------------------------------------------------

    function formatDuration(ms) {
        var seconds = Math.max(1, Math.round(ms / 1000));
        var minutes = Math.floor(seconds / 60);
        return minutes > 0 ? String(minutes) + " min " + padNumber(seconds % 60, 2) + " s" : String(seconds) + " s";
    }

    // Final message: what was made and how long it took, or why it failed.
    function resultMessage(result, kind, elapsedMs) {
        var what = kind === "still" ? "Depth map" : "Depth sequence";
        if (result.status === "done") {
            return what + " done in " + formatDuration(elapsedMs) + ".\n\n" + result.message;
        }
        if (result.partial) {
            return what + " failed while adding it to the comp. Press Undo (Cmd+Z) once to remove what was added.\n\n" + result.message;
        }
        return what + " failed. Nothing was imported.\n\n" + result.message;
    }

    function createWindow() {
        var win = new Window("palette", "Depth Map Tool");
        var tickName = "__pedroDepthMapTick_" + uniqueStamp();
        var taskId = 0;
        var job = null;
        var jobKind = "";
        var jobStarted = 0;
        var qualityGroup;
        var qualityList;
        var guideLayerCheckbox;
        var effectGroup;
        var effectList;
        var generateButton;
        var progressBar;
        var statusText;

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 10;
        win.margins = 16;

        var notice = win.add("statictext", undefined, "Select still image layers to get one depth map each. With nothing selected, the comp work area becomes a depth sequence. Existing depth maps are reused; Option-click Generate to make new ones.\nAfter Effects stays usable while it generates; the window closes and tells you when it is done.", { multiline: true });
        notice.preferredSize = [360, 80];

        qualityGroup = win.add("group");
        qualityGroup.orientation = "row";
        qualityGroup.add("statictext", undefined, "Still quality");
        qualityList = qualityGroup.add("dropdownlist", undefined, QUALITY_LABELS);
        qualityList.selection = 0;

        effectGroup = win.add("group");
        effectGroup.orientation = "row";
        effectGroup.add("statictext", undefined, "Effect");
        effectList = effectGroup.add("dropdownlist", undefined, EFFECT_LABELS);
        effectList.selection = 0;
        effectList.helpTip = "Depth Reveal: the image appears near-first (Gradient Wipe). Depth Sweep: a band of light travels from near to far. Parallax: a small 3D camera move (Displacement Map). Keys start at the current time.";

        guideLayerCheckbox = win.add("checkbox", undefined, "Import as guide layer");
        guideLayerCheckbox.value = true;

        generateButton = win.add("button", undefined, "Generate");
        progressBar = win.add("progressbar", undefined, 0, 100);
        progressBar.preferredSize = [360, 8];
        statusText = win.add("statictext", undefined, "");
        statusText.preferredSize.width = 360;

        function report(text, fraction) {
            if (text) {
                statusText.text = text;
            }
            progressBar.value = Math.round(100 * Math.max(0, Math.min(1, fraction)));
        }

        function setRunning(running) {
            generateButton.text = running ? "Cancel" : "Generate";
            qualityGroup.enabled = !running;
            guideLayerCheckbox.enabled = !running;
            effectGroup.enabled = !running;
        }

        function stopTicking() {
            if (taskId) {
                app.cancelTask(taskId);
                taskId = 0;
            }
        }

        $.global[tickName] = function () {
            var keepGoing;
            if (!job) {
                stopTicking();
                return;
            }
            keepGoing = job.tick();
            if (!keepGoing) {
                var result = job.result;
                var message = resultMessage(result, jobKind, new Date().getTime() - jobStarted);
                stopTicking();
                job = null;
                if (result.status === "done") {
                    win.close();
                    alert(message, "Depth Map Tool");
                    return;
                }
                setRunning(false);
                progressBar.value = 0;
                statusText.text = result.status === "error" ? "Failed." : result.message;
                if (result.status === "error") {
                    alert(message, "Depth Map Tool", true);
                }
            }
        };

        function startJob(newJob, kind) {
            job = newJob;
            jobKind = kind;
            jobStarted = new Date().getTime();
            setRunning(true);
            report("Starting...", 0);
            taskId = app.scheduleTask(tickName + "()", TICK_MS, true);
        }

        generateButton.onClick = function () {
            var comp;
            var plan;
            var setupError;
            var frameCount;
            var options;
            var effect;

            if (job) {
                job.cancel();
                generateButton.text = "Cancelling...";
                return;
            }

            comp = getActiveComp();
            if (!comp) {
                alert("Open a composition first.");
                return;
            }

            plan = planFromSelection(comp);
            if (plan.error) {
                alert(plan.error);
                return;
            }

            setupError = checkSetup(plan.mode);
            if (setupError) {
                alert(setupError);
                return;
            }

            if (plan.mode === "sequence") {
                if (comp.workAreaDuration <= 0) {
                    alert("The comp work area has no duration.");
                    return;
                }
                frameCount = Math.ceil(comp.workAreaDuration / comp.frameDuration - 0.000001);
                if (frameCount > MAX_SEQUENCE_FRAMES) {
                    alert("The work area has " + String(frameCount) + " frames. This beta allows up to " + String(MAX_SEQUENCE_FRAMES) + "; shorten the work area.");
                    return;
                }
                if (comp.workAreaStart < 0 || comp.workAreaStart + comp.workAreaDuration > comp.duration + 0.000001) {
                    alert("Keep the work area inside the composition.");
                    return;
                }
            }

            effect = EFFECT_KINDS[effectList.selection ? effectList.selection.index : 0];
            if (effect === "parallax" && plan.mode !== "still") {
                alert("Parallax works on still images only. Select still image layers, or choose None or Depth Reveal for a sequence.");
                return;
            }

            if (!chooseOutputFolder()) {
                return;
            }

            options = {
                regenerate: !!(ScriptUI.environment && ScriptUI.environment.keyboardState.altKey),
                effect: effect,
                effectTime: plan.mode === "still" ? comp.time : comp.workAreaStart,
                inputSize: plan.mode === "still" ? QUALITY_INPUT_SIZES[qualityList.selection ? qualityList.selection.index : 0] : SEQUENCE_INPUT_SIZE,
                guideLayer: guideLayerCheckbox.value
            };

            startJob(plan.mode === "still" ? createStillJob(comp, plan.layers, options, report) : createSequenceJob(comp, options, report), plan.mode);
        };

        // Closing the window cancels a running job and cleans up its files.
        win.onClose = function () {
            var waited = 0;
            stopTicking();
            if (job) {
                job.cancel();
                while (job.tick() && waited < STOP_TIMEOUT_MS + 2000) {
                    $.sleep(100);
                    waited += 100;
                }
                job = null;
            }
            $.global[tickName] = undefined;
            return true;
        };

        return win;
    }

    createWindow().show();
})();
