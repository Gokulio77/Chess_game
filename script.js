// Wait for the DOM to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {

    // --- Global Variables ---
    let scene, camera, renderer, controls;
    let boardGroup, piecesGroup; // Groups to hold board squares and pieces
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let selectedPiece = null; // Track the currently selected piece
    let originalPieceMaterial = null; // Store the original material of the selected piece

    const boardSize = 8; // Still useful for piece placement logic
    const squareSize = 10; // Still useful for piece placement logic
    const boardDimension = boardSize * squareSize; // Reference dimension

    // --- Materials ---
    const whiteMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.3 });
    const blackMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.3 });
    const selectedMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xaaaa00, roughness: 0.4, metalness: 0.1 }); // Highlight material
    // Default material for loaded board if OBJ doesn't specify/MTL isn't used
    const boardMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.8 });

    // --- Model Loading ---
    const objLoader = new THREE.OBJLoader();
    const loadingManager = new THREE.LoadingManager(); // Use manager for overall progress
    const loadingStatusElement = document.getElementById('loading-status');
    let modelsToLoad = 32 + 1; // 32 pieces + 1 board
    let modelsLoaded = 0;

    loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
        // This might not be accurate per model with OBJLoader, update manually
        // console.log(`Loading file: ${url}. Loaded ${itemsLoaded} of ${itemsTotal} files.`);
    };

    loadingManager.onLoad = () => {
        console.log('All models loaded (or attempted).');
        if (loadingStatusElement) loadingStatusElement.textContent = 'Models loaded.';
        // Hide status after a delay
        setTimeout(() => {
            if (loadingStatusElement) loadingStatusElement.style.display = 'none';
        }, 2000);
    };

    loadingManager.onError = (url) => {
        console.error(`There was an error loading ${url}`);
        if (loadingStatusElement) loadingStatusElement.textContent = `Error loading model: ${url}`;
        // Handle failed load
        modelLoadComplete(); // Still count it as completed attempt
    };

     // Function to update loading progress
    function modelLoadComplete() {
        modelsLoaded++;
        if (loadingStatusElement) {
           loadingStatusElement.textContent = `Loading board and models... (${modelsLoaded}/${modelsToLoad})`;
        }
        // Check if all loading attempts are complete (success or error)
        if (modelsLoaded === modelsToLoad) {
            // Ensure onLoad fires even if individual loads fail fast
             setTimeout(() => loadingManager.onLoad(), 0);
        }
    }

    // --- Initialization ---
    function init() {
        // Scene setup
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xeeeeee);

        // Camera setup
        const canvas = document.getElementById('chessCanvas');
        camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 1, 1000);
        camera.position.set(0, boardDimension * 0.8, boardDimension * 1.1); // Adjust initial camera if needed
        camera.lookAt(0, 0, 0);

        // Renderer setup
        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
        renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
        directionalLight.position.set(40, 60, 30);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 10;
        directionalLight.shadow.camera.far = 200;
        directionalLight.shadow.camera.left = -boardDimension * 0.8;
        directionalLight.shadow.camera.right = boardDimension * 0.8;
        directionalLight.shadow.camera.top = boardDimension * 0.8;
        directionalLight.shadow.camera.bottom = -boardDimension * 0.8;
        directionalLight.shadow.bias = -0.0005;
        scene.add(directionalLight);

        // Controls setup
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
        controls.screenSpacePanning = false;
        controls.maxPolarAngle = Math.PI / 2 - 0.05;
        controls.minDistance = boardDimension * 0.3;
        controls.maxDistance = boardDimension * 2.5;
        controls.target.set(0, 0, 0);
        controls.update();

        // Create board and pieces groups
        boardGroup = new THREE.Group(); // Group to hold the loaded board
        piecesGroup = new THREE.Group();
        scene.add(boardGroup);
        scene.add(piecesGroup);

        // --- Trigger Loading ---
        modelsLoaded = 0; // Reset counter before loading starts
        if (loadingStatusElement) loadingStatusElement.textContent = `Loading board and models... (0/${modelsToLoad})`;
        createChessboard(); // Load the board model
        setupInitialPieces(); // Load piece models

        // Event Listeners
        window.addEventListener('resize', onWindowResize, false);
        renderer.domElement.addEventListener('click', onMouseClick, false);

        // Start the animation loop
        animate();
    }

    // --- Chessboard Creation (Loading OBJ) ---
    function createChessboard() {
        // --- !!! REPLACE THIS WITH THE ACTUAL URL TO YOUR HOSTED chessboard.obj !!! ---
        const boardModelUrl = "https://gokulio77.github.io/Chess_game/"; // e.g., "https://yourdomain.com/models/chessboard.obj"

        console.log(`Attempting to load board model from: ${boardModelUrl}`);

        objLoader.load(
            boardModelUrl,
            // onLoad callback
            (object) => {
                console.log("Chessboard model loaded successfully.");
                // Process the loaded board object
                object.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        // Apply default material if needed (OBJ might not have materials or MTL not loaded)
                        if (!child.material || Array.isArray(child.material)) {
                             child.material = boardMaterial;
                        }
                        child.receiveShadow = true; // Board should receive shadows from pieces
                        child.castShadow = false; // Board itself doesn't need to cast shadows usually
                    }
                });

                // --- CRITICAL ADJUSTMENTS for the BOARD ---
                // You MUST adjust scale, position, and rotation for your specific model.
                // Goal: Center the board at world origin (0,0,0) with its top surface at Y=0.
                //       Scale it appropriately for the pieces (using boardDimension as a reference).

                // Example Adjustments (GUESSWORK - REPLACE WITH YOUR VALUES):
                const desiredBoardSize = boardDimension; // Target size (e.g., 80x80 if squareSize=10)

                // 1. Calculate current size and center
                const box = new THREE.Box3().setFromObject(object);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());

                // 2. Calculate scale factor (assuming uniform scale is desired)
                // Use the largest dimension of the loaded model to determine scale factor
                const maxDim = Math.max(size.x, size.y, size.z);
                 // Use X or Z size for board scaling, assuming Y is height
                const scaleFactor = desiredBoardSize / Math.max(size.x, size.z); // Adjust based on your model's dominant plane

                // 3. Apply scale
                object.scale.set(scaleFactor, scaleFactor, scaleFactor);

                // 4. Recalculate bounds after scaling
                const scaledBox = new THREE.Box3().setFromObject(object);
                const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
                const scaledSize = scaledBox.getSize(new THREE.Vector3());

                // 5. Adjust position to center and set top at Y=0
                // Move object so its calculated center goes to origin,
                // then lift it so its bottom is at -scaledSize.y / 2 (making top at +scaledSize.y / 2)
                // Adjust Y position so the *top* surface is at Y=0
                object.position.x = -scaledCenter.x;
                object.position.y = -scaledBox.min.y; // Move bottom to Y=0
                // If you want the *center* of the board's height at Y=0 instead:
                // object.position.y = -scaledCenter.y;
                object.position.z = -scaledCenter.z;


                // 6. Adjust rotation if necessary (e.g., if board is upright)
                // object.rotation.x = -Math.PI / 2; // Example: Rotate if Z-up export

                boardGroup.add(object); // Add the processed board to its group
                console.log("Board model processed and added to scene.");
                 modelLoadComplete(); // Mark board load complete
            },
            // onProgress
            undefined, // Use LoadingManager
            // onError
            (error) => {
                console.error(`Failed to load chessboard model from: ${boardModelUrl}`, error);
                if (loadingStatusElement) loadingStatusElement.textContent = `Error loading board!`;
                // Maybe add a fallback simple plane?
                const fallbackGeo = new THREE.PlaneGeometry(boardDimension, boardDimension);
                const fallbackMat = new THREE.MeshStandardMaterial({color: 0x888888});
                const fallbackPlane = new THREE.Mesh(fallbackGeo, fallbackMat);
                fallbackPlane.rotation.x = -Math.PI / 2;
                fallbackPlane.receiveShadow = true;
                boardGroup.add(fallbackPlane);
                console.log("Added fallback plane for board.");
                modelLoadComplete(); // Mark attempt complete even on error
            }
        );
    }


    // --- Piece Placement & Model Loading ---

    // Helper to get world position from board coordinates
    function getWorldPos(boardX, boardY) {
         return {
            x: (boardX * squareSize) - (boardDimension / 2 - squareSize / 2),
            z: (boardY * squareSize) - (boardDimension / 2 - squareSize / 2)
        };
    }

    // Function to load a single OBJ model for a PIECE
    function loadObjPiece(modelUrl, pieceMaterial, pieceUserData, position) {
        objLoader.load( modelUrl, (object) => {
                let mesh = null;
                object.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        mesh = child;
                        mesh.material = pieceMaterial;
                        mesh.castShadow = true;
                        mesh.receiveShadow = false;

                        // --- Piece Adjustments (EXAMPLE - TUNE THESE) ---
                        const pieceScaleFactor = 4.0; // Adjust scale relative to board/export size
                        mesh.scale.set(pieceScaleFactor, pieceScaleFactor, pieceScaleFactor);
                        // mesh.rotation.y = Math.PI; // Rotate if facing wrong way
                    }
                });

                if (mesh) {
                    const box = new THREE.Box3().setFromObject(mesh);
                    const size = box.getSize(new THREE.Vector3());
                    mesh.position.set(position.x, size.y / 2, position.z); // Position base on board
                    mesh.userData = pieceUserData;
                    piecesGroup.add(mesh);
                } else { console.error(`No mesh found in ${modelUrl}`); }
                modelLoadComplete();
            },
            undefined, // onProgress
            (error) => { console.error(`Error loading piece ${modelUrl}`, error); modelLoadComplete(); }
        );
    }

    // Get the URL for a specific piece type (PLACEHOLDERS!)
    function getModelUrl(type, isWhite) {
        // --- !!! REPLACE THESE WITH ACTUAL URLS TO YOUR HOSTED MODELS !!! ---
        const colorPrefix = isWhite ? 'White' : 'Black';
        switch (type) {
            // Ensure these paths match where you host your files
            case 'Pawn':   return `https://gokulio77.github.io/Chess_game/`;
            case 'Rook':   return `https://gokulio77.github.io/Chess_game/`;
            case 'Knight': return `https://gokulio77.github.io/Chess_game/`;
            case 'Bishop': return `https://gokulio77.github.io/Chess_game/`;
            case 'Queen':  return `https://gokulio77.github.io/Chess_game/`;
            case 'King':   return `https://gokulio77.github.io/Chess_game/`;
            default:       console.error("Unknown piece type for model URL:", type); return null;
        }
    }

    // Modified function to place pieces by loading models
    function createAndPlacePiece(type, isWhite, boardX, boardY) {
        const pieceMaterial = isWhite ? whiteMaterial : blackMaterial;
        const pieceName = (isWhite ? 'White ' : 'Black ') + type;
        const modelUrl = getModelUrl(type, isWhite);
        if (!modelUrl) { modelLoadComplete(); return; } // Skip if no URL
        const worldPos = getWorldPos(boardX, boardY);
        const pieceUserData = { type: 'piece', pieceType: type, isWhite: isWhite, board_x: boardX, board_y: boardY, name: pieceName };
        loadObjPiece(modelUrl, pieceMaterial, pieceUserData, worldPos);
    }

    // Setup initial pieces by triggering model loads
    function setupInitialPieces() {
        const pieceOrder = ['Rook', 'Knight', 'Bishop', 'Queen', 'King', 'Bishop', 'Knight', 'Rook'];
        // Place white pieces (triggering loads)
        for (let i = 0; i < boardSize; i++) { createAndPlacePiece('Pawn', true, i, 1); createAndPlacePiece(pieceOrder[i], true, i, 0); }
        // Place black pieces (triggering loads)
        for (let i = 0; i < boardSize; i++) { createAndPlacePiece('Pawn', false, i, 6); createAndPlacePiece(pieceOrder[i], false, i, 7); }
    }


    // --- Event Handlers ---
    function onWindowResize() {
        const canvas = document.getElementById('chessCanvas');
        const container = document.getElementById('container');
        const containerStyle = window.getComputedStyle(container);
        const containerPadding = parseFloat(containerStyle.paddingLeft) + parseFloat(containerStyle.paddingRight);
        const width = container.clientWidth - containerPadding;
        const height = canvas.clientHeight;
        canvas.style.width = width + 'px';
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }

     function onMouseClick(event) {
        const canvasBounds = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - canvasBounds.left) / canvasBounds.width) * 2 - 1;
        mouse.y = -((event.clientY - canvasBounds.top) / canvasBounds.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(piecesGroup.children, true); // Check pieces

        // Reset previously selected piece material
        if (selectedPiece) {
             selectedPiece.traverse((child) => { if (child instanceof THREE.Mesh) { child.material = originalPieceMaterial; } });
            selectedPiece = null; originalPieceMaterial = null;
        }

        if (intersects.length > 0) {
            let clickedPieceObject = null;
            for(let i = 0; i < intersects.length; i++) { // Find parent object with userData
                let obj = intersects[i].object;
                while(obj && !obj.userData.type) { obj = obj.parent; }
                if (obj && obj.userData.type === 'piece') { clickedPieceObject = obj; break; }
            }
            if (clickedPieceObject) {
                selectedPiece = clickedPieceObject;
                 selectedPiece.traverse((child) => { // Apply highlight
                     if (child instanceof THREE.Mesh) { originalPieceMaterial = child.material; child.material = selectedMaterial; }
                 });
                console.log("Selected:", selectedPiece.userData.name, "at", selectedPiece.userData.board_x, selectedPiece.userData.board_y);
                // TODO: Implement move logic
            }
        }
        // else { console.log("Clicked on empty space or board."); } // Clicked off piece
    }


    // --- Animation Loop ---
    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }

    // --- Start the application ---
    init();
    onWindowResize(); // Initial resize call

}); // End DOMContentLoaded listener
