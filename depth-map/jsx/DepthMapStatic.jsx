(function depthMapStaticTool() {
    var SCRIPT_FILE = new File($.fileName);
    var SCRIPT_DIR = SCRIPT_FILE.parent;
    var PROJECT_DIR = SCRIPT_DIR.parent;
    var BACKEND_SCRIPT = new File(PROJECT_DIR.fsName + "/backend/generate_depth.py");
    var SEQUENCE_BACKEND_SCRIPT = new File(PROJECT_DIR.fsName + "/backend/generate_depth_sequence.py");
    var VDA_SEQUENCE_BACKEND_SCRIPT = new File(PROJECT_DIR.fsName + "/backend/generate_vda_sequence.py");
    var VENV_PYTHON = new File(PROJECT_DIR.fsName + "/backend/.venv/bin/python");
    var OUTPUT_ROOT = null;
    var DEFAULT_ENCODER = "vits";
    var DEFAULT_INPUT_SIZE = 518;
    var ENCODER_LABELS = ["vits - Small", "vitb - Base (non-commercial weights)", "vitl - Large (non-commercial weights)"];
    var SEQUENCE_BACKEND_LABELS = ["Video Depth Anything", "Frame batch"];

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

    function getSelectedFootageFile() {
        var comp = getActiveComp();
        var layer;
        var source;

        if (!comp || comp.selectedLayers.length !== 1) {
            return null;
        }

        layer = comp.selectedLayers[0];
        source = layer.source;

        if (source && source instanceof FootageItem && source.file && source.file.exists) {
            return source.file;
        }

        return null;
    }

    function chooseOutputFolder() {
        if (!OUTPUT_ROOT || !OUTPUT_ROOT.exists) OUTPUT_ROOT = Folder.selectDialog("Choose a permanent folder for depth outputs (keep it with your project)");
        return !!OUTPUT_ROOT;
    }

    function makeOutputFile(inputFile) {
        var outputFolder = OUTPUT_ROOT;
        var baseName = inputFile.displayName.replace(/\.[^\.]+$/, "");
        var stamp = String(new Date().getTime());

        if (!outputFolder.exists) {
            outputFolder.create();
        }

        return new File(outputFolder.fsName + "/" + baseName + "_depth_" + stamp + ".png");
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
        var root = new Folder(OUTPUT_ROOT.fsName + "/" + sanitizeName(comp.name) + "_" + String(new Date().getTime()) + "_" + Math.floor(Math.random()*1000000));
        var sourceFolder = new Folder(root.fsName + "/source");
        var depthFolder = new Folder(root.fsName + "/depth");
        var logFile = new File(root.fsName + "/sequence_log.txt");

        if (!root.create() || !sourceFolder.create() || !depthFolder.create()) {
            throw new Error("Could not create sequence output folders.");
        }

        return {
            root: root,
            source: sourceFolder,
            depth: depthFolder,
            log: logFile
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

    function waitForFile(file, timeoutMs) {
        var started = new Date().getTime();

        while (!file.exists && (new Date().getTime() - started) < timeoutMs) {
            $.sleep(100);
        }

        return file.exists;
    }

    function importDepthMap(depthFile, importAsGuideLayer) {
        var comp = getActiveComp();
        var importOptions;
        var footage;
        var layer;

        if (!depthFile.exists) {
            throw new Error("Depth map was not created: " + depthFile.fsName);
        }

        importOptions = new ImportOptions(depthFile);
        footage = app.project.importFile(importOptions);
        footage.name = depthFile.displayName;

        if (comp) {
            layer = comp.layers.add(footage);
            layer.name = footage.name;
            layer.guideLayer = !!importAsGuideLayer;
        }

        return footage;
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

        footage.mainSource.conformFrameRate = 1 / comp.frameDuration;

        layer = comp.layers.add(footage);
        layer.name = footage.name;
        layer.startTime = startTime;
        layer.guideLayer = !!importAsGuideLayer;

        return footage;
    }

    function buildCommand(inputFile, outputFile, options) {
        var args = [];
        var pythonCommand = shellQuote(VENV_PYTHON.fsName);

        args.push(shellQuote(BACKEND_SCRIPT.fsName));
        args.push("--input " + shellQuote(inputFile.fsName));
        args.push("--output " + shellQuote(outputFile.fsName));
        args.push("--encoder " + shellQuote(options.encoder));
        args.push("--input-size " + String(options.inputSize));
        args.push("--device auto");
        args.push("--clip-low " + String(options.clipLow));
        args.push("--clip-high " + String(options.clipHigh));
        args.push("--gamma " + String(options.gamma));
        args.push("--blur " + String(options.blur));

        if (options.invert) {
            args.push("--invert");
        }

        return pythonCommand + " " + args.join(" ");
    }

    function buildSequenceCommand(inputFolder, outputFolder, options, fps) {
        var args = [];
        var pythonCommand = shellQuote(VENV_PYTHON.fsName);
        var backendScript = options.sequenceBackend === "vda" ? VDA_SEQUENCE_BACKEND_SCRIPT : SEQUENCE_BACKEND_SCRIPT;

        args.push(shellQuote(backendScript.fsName));
        args.push("--input-dir " + shellQuote(inputFolder.fsName));
        args.push("--output-dir " + shellQuote(outputFolder.fsName));
        args.push("--pattern " + shellQuote("frame_*.png"));
        args.push("--prefix " + shellQuote(options.sequenceBackend === "vda" ? "vda_depth_" : "depth_"));
        args.push("--encoder " + shellQuote(options.encoder));
        args.push("--input-size " + String(options.inputSize));
        args.push("--device auto");
        args.push("--clip-low " + String(options.clipLow));
        args.push("--clip-high " + String(options.clipHigh));
        args.push("--gamma " + String(options.gamma));
        args.push("--blur " + String(options.blur));

        if (options.sequenceBackend === "vda") {
            args.push("--fps " + String(fps));
        } else {
            args.push("--temporal-smoothing " + String(options.temporalSmoothing));
        }

        if (options.invert) {
            args.push("--invert");
        }

        return pythonCommand + " " + args.join(" ");
    }

    function getCheckpointFile(encoder) {
        return new File(PROJECT_DIR.fsName + "/backend/vendor/Depth-Anything-V2/checkpoints/depth_anything_v2_" + encoder + ".pth");
    }

    function getVdaCheckpointFile(encoder) {
        return new File(PROJECT_DIR.fsName + "/backend/vendor/Video-Depth-Anything/checkpoints/video_depth_anything_" + encoder + ".pth");
    }

    function generateDepth(inputFile, options) {
        var outputFile = makeOutputFile(inputFile);
        var command = buildCommand(inputFile, outputFile, options);
        var result = system.callSystem(command + " 2>&1");

        if (!outputFile.exists) {
            throw new Error("Depth generation failed.\n\nCommand:\n" + command + "\n\nOutput:\n" + result);
        }

        return outputFile;
    }

    function exportWorkAreaFrames(comp, outputFolder, statusText, win, logFile) {
        var frameDuration = comp.frameDuration;
        var startTime = comp.workAreaStart;
        var duration = comp.workAreaDuration;
        var frameCount = Math.max(1, Math.ceil(duration / frameDuration - 0.000001));
        var i;
        var frameTime;
        var frameFile;

        for (i = 0; i < frameCount; i += 1) {
            frameTime = startTime + (i * frameDuration);
            frameFile = new File(outputFolder.fsName + "/frame_" + padNumber(i + 1, 6) + ".png");
            statusText.text = "Exporting frame " + String(i + 1) + " / " + String(frameCount);
            win.update();
            appendLog(logFile, "Exporting frame " + String(i + 1) + "/" + String(frameCount) + " at time " + String(frameTime) + " to " + frameFile.fsName);
            comp.saveFrameToPng(frameTime, frameFile);

            if (!waitForFile(frameFile, 10000)) {
                throw new Error("After Effects did not export frame: " + frameFile.fsName);
            }
        }

        return {
            firstFrame: new File(outputFolder.fsName + "/frame_000001.png"),
            frameCount: frameCount,
            startTime: startTime
        };
    }

    function generateDepthSequence(sourceFolder, depthFolder, options, fps, logFile, expectedFrames) {
        var command = buildSequenceCommand(sourceFolder, depthFolder, options, fps);
        appendLog(logFile, "Running sequence command: " + command);
        var result = system.callSystem(command + " 2>&1");
        var firstFrame = new File(depthFolder.fsName + "/" + (options.sequenceBackend === "vda" ? "vda_depth_" : "depth_") + "frame_000001.png");
        appendLog(logFile, "Sequence command output:\n" + result);

        var completed = new File(depthFolder.fsName + "/depth_complete.json");
        var prefix = options.sequenceBackend === "vda" ? "vda_depth_" : "depth_";
        var frames = depthFolder.getFiles(prefix + "frame_*.png");
        if (!firstFrame.exists || !completed.exists || frames.length !== expectedFrames) {
            throw new Error("Depth sequence generation failed.\n\nCommand:\n" + command + "\n\nOutput:\n" + result);
        }

        return firstFrame;
    }

    function parseNumberField(field, fallback) {
        var text = String(field.text).replace(",", ".").replace(/^\s+|\s+$/g, "");
        var value = text ? Number(text) : NaN;
        return value;
    }

    function addNumberRow(win, label, defaultValue, chars) {
        var group = win.add("group");
        var input;

        group.orientation = "row";
        group.add("statictext", undefined, label);
        input = group.add("edittext", undefined, String(defaultValue));
        input.characters = chars || 6;

        return input;
    }

    function createWindow() {
        var win = new Window("palette", "Depth Map Tool");
        var selectedText;
        var staticLabel;
        var sequenceLabel;
        var inputButton;
        var generateButton;
        var generateSequenceButton;
        var encoderGroup;
        var encoderList;
        var sequenceBackendGroup;
        var sequenceBackendList;
        var sizeGroup;
        var sizeInput;
        var clipLowInput;
        var clipHighInput;
        var gammaInput;
        var blurInput;
        var temporalSmoothingGroup;
        var temporalSmoothingInput;
        var invertCheckbox;
        var guideLayerCheckbox;
        var statusText;
        var inputFile = getSelectedFootageFile();

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 10;
        win.margins = 16;

        var notice = win.add("statictext", undefined, "Experimental — local inference; no models bundled. Output files are not removed by Undo.\nWhile a depth map is generating, After Effects stops responding until it finishes; there is no cancel. Start with a short work area.", { multiline: true });
        notice.preferredSize = [360, 64];
        selectedText = win.add("statictext", undefined, "");
        selectedText.preferredSize.width = 360;

        staticLabel = win.add("statictext", undefined, "1. Static image");
        staticLabel.preferredSize.width = 360;
        inputButton = win.add("button", undefined, "Choose Image...");

        encoderGroup = win.add("group");
        encoderGroup.orientation = "row";
        encoderGroup.add("statictext", undefined, "Encoder");
        encoderList = encoderGroup.add("dropdownlist", undefined, ENCODER_LABELS);
        encoderList.selection = 0;

        sequenceBackendGroup = win.add("group");
        sequenceBackendGroup.orientation = "row";
        sequenceBackendGroup.add("statictext", undefined, "Sequence backend");
        sequenceBackendList = sequenceBackendGroup.add("dropdownlist", undefined, SEQUENCE_BACKEND_LABELS);
        sequenceBackendList.selection = 0;

        sizeGroup = win.add("group");
        sizeGroup.orientation = "row";
        sizeGroup.add("statictext", undefined, "Input size");
        sizeInput = sizeGroup.add("edittext", undefined, String(DEFAULT_INPUT_SIZE));
        sizeInput.characters = 6;

        clipLowInput = addNumberRow(win, "Clip low %", 0, 6);
        clipHighInput = addNumberRow(win, "Clip high %", 100, 6);
        gammaInput = addNumberRow(win, "Gamma", 1, 6);
        blurInput = addNumberRow(win, "Blur px", 0, 6);
        temporalSmoothingGroup = win.add("group");
        temporalSmoothingGroup.orientation = "row";
        temporalSmoothingGroup.add("statictext", undefined, "Temporal smoothing");
        temporalSmoothingInput = temporalSmoothingGroup.add("edittext", undefined, "0");
        temporalSmoothingInput.characters = 6;

        invertCheckbox = win.add("checkbox", undefined, "Invert depth");
        guideLayerCheckbox = win.add("checkbox", undefined, "Import as guide layer");
        guideLayerCheckbox.value = true;

        generateButton = win.add("button", undefined, "Generate Static Depth Map");
        sequenceLabel = win.add("statictext", undefined, "2. Active comp work area");
        sequenceLabel.preferredSize.width = 360;
        generateSequenceButton = win.add("button", undefined, "Generate Comp Work Area Sequence");
        statusText = win.add("statictext", undefined, "");
        statusText.preferredSize.width = 360;

        function getSelectedSequenceBackend() {
            return sequenceBackendList.selection && sequenceBackendList.selection.text === "Video Depth Anything" ? "vda" : "batch";
        }

        function syncSequenceBackendUi() {
            var isBatch = getSelectedSequenceBackend() === "batch";
            temporalSmoothingInput.enabled = isBatch;
            temporalSmoothingGroup.enabled = isBatch;
            if (!isBatch) {
                temporalSmoothingInput.text = "0";
            }
        }

        function refreshInputLabel() {
            selectedText.text = inputFile ? "Static input: " + inputFile.fsName : "Static input: selected footage or choose an image";
        }

        inputButton.onClick = function () {
            var picked = File.openDialog("Choose a static image", "*.png;*.jpg;*.jpeg;*.tif;*.tiff");
            if (picked) {
                inputFile = picked;
                refreshInputLabel();
            }
        };

        sequenceBackendList.onChange = syncSequenceBackendUi;

        function readOptions(isSequence) {
            var encoder = encoderList.selection ? encoderList.selection.text.split(" ")[0] : DEFAULT_ENCODER;
            var inputSize = Number(sizeInput.text);
            var clipLow = parseNumberField(clipLowInput, 0);
            var clipHigh = parseNumberField(clipHighInput, 100);
            var gamma = parseNumberField(gammaInput, 1);
            var blur = parseNumberField(blurInput, 0);
            var temporalSmoothing = parseNumberField(temporalSmoothingInput, 0);
            var checkpointFile = getCheckpointFile(encoder);
            var sequenceBackend = getSelectedSequenceBackend();
            var vdaCheckpointFile = getVdaCheckpointFile(encoder);
            var options;

            if ($.os.indexOf("Mac") < 0) { alert("The AE launcher currently supports macOS only. See README for CLI usage."); return null; }
            if (!VENV_PYTHON.exists) { alert("Python environment not installed. Follow depth-map/README.md before using this panel."); return null; }

            if (!BACKEND_SCRIPT.exists) {
                alert("Backend script not found: " + BACKEND_SCRIPT.fsName);
                return null;
            }

            if (!SEQUENCE_BACKEND_SCRIPT.exists) {
                alert("Sequence backend script not found: " + SEQUENCE_BACKEND_SCRIPT.fsName);
                return null;
            }

            if (!VDA_SEQUENCE_BACKEND_SCRIPT.exists) {
                alert("VDA sequence backend script not found: " + VDA_SEQUENCE_BACKEND_SCRIPT.fsName);
                return null;
            }

            if ((!isSequence || sequenceBackend === "batch") && !checkpointFile.exists) {
                alert(
                    "Checkpoint not installed for encoder '" + encoder + "'.\n\n" +
                    "No weights are bundled. Download the selected model separately (see README).\n\n" +
                    "Expected file:\n" + checkpointFile.fsName
                );
                return null;
            }

            if (isSequence && sequenceBackend === "vda" && !vdaCheckpointFile.exists) {
                alert(
                    "Video Depth Anything checkpoint not installed for encoder '" + encoder + "'.\n\n" +
                    "No weights are bundled. Download the selected model separately (see README).\n\n" +
                    "Expected file:\n" + vdaCheckpointFile.fsName
                );
                return null;
            }

            if (!isFinite(inputSize) || inputSize !== Math.floor(inputSize) || inputSize < 64 || inputSize > 4096) {
                alert("Input size must be a whole number between 64 and 4096.");
                return null;
            }

            if (!isFinite(clipLow) || !isFinite(clipHigh) || clipLow < 0 || clipHigh > 100 || clipLow >= clipHigh) {
                alert("Clip low/high must be valid percentiles between 0 and 100.");
                return null;
            }

            if (!isFinite(gamma) || gamma <= 0) {
                alert("Gamma must be greater than 0.");
                return null;
            }

            if (!isFinite(blur) || blur < 0 || blur > 100) {
                alert("Blur must be between 0 and 100 px.");
                return null;
            }

            if (!isFinite(temporalSmoothing) || temporalSmoothing < 0 || temporalSmoothing >= 1) {
                alert("Temporal smoothing must be >= 0 and < 1.");
                return null;
            }

            options = {
                encoder: encoder,
                inputSize: inputSize,
                clipLow: clipLow,
                clipHigh: clipHigh,
                gamma: gamma,
                blur: blur,
                temporalSmoothing: temporalSmoothing,
                sequenceBackend: sequenceBackend,
                invert: invertCheckbox.value
            };

            return options;
        }

        generateButton.onClick = function () {
            var options = readOptions(false);
            var outputFile;

            if (!options) {
                return;
            }

            if (!inputFile || !inputFile.exists) {
                inputFile = getSelectedFootageFile();
            }

            if (!inputFile || !inputFile.exists) {
                alert("Select one footage layer with a source file, or choose an image manually.");
                return;
            }

            if (!chooseOutputFolder()) return;
            app.beginUndoGroup("Generate Static Depth Map");
            try {
                statusText.text = "Generating... After Effects will not respond until this finishes.";
                win.update();
                outputFile = generateDepth(inputFile, options);
                importDepthMap(outputFile, guideLayerCheckbox.value);
                statusText.text = "Imported: " + outputFile.fsName;
            } catch (err) {
                statusText.text = "Error.";
                alert(err.toString());
            } finally {
                app.endUndoGroup();
            }
        };

        generateSequenceButton.onClick = function () {
            var options = readOptions(true);
            var comp = getActiveComp();
            var folders;
            var exportResult;
            var firstDepthFrame;

            if (!options) {
                return;
            }

            if (!comp) {
                alert("Open a composition before generating a work area sequence.");
                return;
            }

            if (comp.workAreaDuration <= 0) {
                alert("The active comp work area has no duration.");
                return;
            }

            if (Math.ceil(comp.workAreaDuration / comp.frameDuration - 0.000001) > 300) {
                alert("This beta limits the panel to 300 frames. Shorten the work area; advanced CLI users can override --max-frames.");
                return;
            }
            if (comp.workAreaStart < 0 || comp.workAreaStart + comp.workAreaDuration > comp.duration + 0.000001) {
                alert("Keep the work area inside the composition."); return;
            }
            if (!chooseOutputFolder()) return;

            app.beginUndoGroup("Generate Work Area Depth Sequence");
            try {
                statusText.text = "Using " + (options.sequenceBackend === "vda" ? "Video Depth Anything" : "Frame batch") + ". Static input is ignored.";
                win.update();
                folders = makeSequenceFolders(comp);
                appendLog(folders.log, "Starting sequence for comp: " + comp.name);
                appendLog(folders.log, "Work area start: " + String(comp.workAreaStart) + ", duration: " + String(comp.workAreaDuration) + ", frame duration: " + String(comp.frameDuration));
                exportResult = exportWorkAreaFrames(comp, folders.source, statusText, win, folders.log);
                statusText.text = "Generating depth sequence... After Effects will not respond until this finishes.";
                win.update();
                firstDepthFrame = generateDepthSequence(folders.source, folders.depth, options, 1 / comp.frameDuration, folders.log, exportResult.frameCount);
                appendLog(folders.log, "Importing first depth frame: " + firstDepthFrame.fsName);
                importDepthSequence(firstDepthFrame, comp, guideLayerCheckbox.value, exportResult.startTime);
                statusText.text = "Imported sequence: " + folders.depth.fsName;
            } catch (err) {
                statusText.text = "Error.";
                if (folders && folders.log) {
                    appendLog(folders.log, "ERROR: " + err.toString());
                    alert(err.toString() + "\n\nLog:\n" + folders.log.fsName);
                } else {
                    alert(err.toString());
                }
            } finally {
                app.endUndoGroup();
            }
        };

        refreshInputLabel();
        syncSequenceBackendUi();
        return win;
    }

    createWindow().show();
})();
