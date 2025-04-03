// Wait for the DOM to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {

    // --- Global Variables ---
    let scene, camera, renderer, controls;
    let boardGroup, piecesGroup; // Groups to hold board and pieces
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let selectedPiece = null; // Track the currently selected piece (the mesh itself)
    let originalPieceMaterial = null; // Store the original material of the selected piece

    const boardSize = 8;
    const squareSize = 10; // Base size for positioning logic
    const boardDimension = boardSize * squareSize; // Reference dimension

    // --- Materials ---
    const whiteMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.3, name: 'whiteMat' });
    const blackMaterial = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.3, name: 'blackMat' });
    const selectedMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xaaaa00, roughness: 0.4, metalness: 0.1, name: 'selectedMat' }); // Highlight material
    // Default material for loaded board if needed
    const boardMaterial = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.8, name: 'boardMat' });

    // --- Model Loading ---
    const objLoader = new THREE.OBJLoader();
    const loadingManager = new THREE.LoadingManager();
    const loadingStatusElement = document.getElementById('loading-status');
    let modelsToLoad = 2; // 1 board + 1 pieces file
    let modelsLoaded = 0;
    let pieceTemplates = {}; // Store loaded piece geometries/meshes by name

    loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
        // Update progress manually in modelLoadComplete
    };

    loadingManager.onLoad = () => {
        console.log('Loading complete (all attempts finished). Placing pieces...');
        if (loadingStatusElement) loadingStatusElement.textContent = 'Models loaded. Placing pieces...';
        // Now that both board and pieces *might* be loaded, place the pieces
        placePiecesFromTemplates();
        // Hide status after a delay
        setTimeout(() => {
            if (loadingStatusElement) loadingStatusElement.style.display = 'none';
        }, 2000);
    };

    loadingManager.onError = (url) => {
        console.error(`There was an error loading ${url}`);
        if (loadingStatusElement) loadingStatusElement.textContent = `Error loading: ${url}`;
        modelLoadComplete(); // Still count attempt
    };

    // Function to update loading progress
    function modelLoadComplete() {
        modelsLoaded++;
        if (loadingStatusElement) {
            loadingStatusElement.textContent = `Loading... (${modelsLoaded}/${modelsToLoad})`;
        }
        // Check if all loading attempts are complete (success or error)
        if (modelsLoaded === modelsToLoad) {
            // Trigger the manager's onLoad now that both attempts are done
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
        camera.position.set(0, boardDimension * 0.8, boardDimension * 1.1);
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
        boardGroup = new THREE.Group();
        piecesGroup = new THREE.Group();
        scene.add(boardGroup);
        scene.add(piecesGroup);

        // --- Trigger Loading ---
        modelsLoaded = 0; // Reset counter
        if (loadingStatusElement) loadingStatusElement.textContent = `Loading... (0/${modelsToLoad})`;
        loadChessboardModel(); // Load the board
        loadPieceModels(); // Load the single pieces file

        // Event Listeners
        window.addEventListener('resize', onWindowResize, false);
        renderer.domElement.addEventListener('click', onMouseClick, false);

        // Start the animation loop
        animate();
    }

    // --- Chessboard Model Loading ---
    function loadChessboardModel() {
        const boardModelUrl = "https://gokulio77.github.io/Chess_game/models/chessboard.obj"; // User provided URL
        console.log(`Attempting to load board model from: ${boardModelUrl}`);

        objLoader.load( boardModelUrl,
            (object) => { // onLoad
                console.log("Chessboard model loaded successfully.");
                object.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        if (!child.material || Array.isArray(child.material)) {
                             child.material = boardMaterial;
                        }
                        child.receiveShadow = true;
                        child.castShadow = false;
                    }
                });

                // --- CRITICAL ADJUSTMENTS for the BOARD ---
                // You MUST adjust these based on your specific model.
                const desiredBoardSize = boardDimension;
                const box = new THREE.Box3().setFromObject(object);
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.z);
                const scaleFactor = (maxDim > 0) ? (desiredBoardSize / maxDim) : 1;

                object.scale.set(scaleFactor, scaleFactor, scaleFactor);

                const scaledBox = new THREE.Box3().setFromObject(object);
                const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

                object.position.x = -scaledCenter.x;
                object.position.y = -scaledBox.min.y; // Set bottom of the board at Y=0
                object.position.z = -scaledCenter.z;

                boardGroup.add(object);
                console.log("Board model processed and added to scene.");
                modelLoadComplete();
            },
            undefined, // onProgress
            (error) => { // onError
                console.error(`Failed to load chessboard model from: ${boardModelUrl}`, error);
                const fallbackGeo = new THREE.PlaneGeometry(boardDimension, boardDimension);
                const fallbackMat = new THREE.MeshStandardMaterial({color: 0x888888});
                const fallbackPlane = new THREE.Mesh(fallbackGeo, fallbackMat);
                fallbackPlane.rotation.x = -Math.PI / 2;
                fallbackPlane.receiveShadow = true;
                boardGroup.add(fallbackPlane);
                console.log("Added fallback plane for board.");
                modelLoadComplete();
            }
        );
    }

    // --- Piece Models Loading (Single File) ---
    function loadPieceModels() {
        const piecesModelUrl = "https://gokulio77.github.io/Chess_game/models/chess.obj"; // User provided URL
        console.log(`Attempting to load pieces model from: ${piecesModelUrl}`);

        objLoader.load( piecesModelUrl,
            (object) => { // onLoad
                console.log("Pieces model file loaded successfully.");
                object.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        const meshName = child.name.trim();
                        if (meshName) {
                           console.log(`Found mesh template: ${meshName}`);
                           pieceTemplates[meshName] = child;
                        } else {
                           console.warn("Found mesh with empty name, skipping template storage.");
                        }
                    }
                });
                 console.log("Piece templates extracted:", Object.keys(pieceTemplates));
                 modelLoadComplete();
            },
            undefined, // onProgress
            (error) => { // onError
                 console.error(`Failed to load pieces model from: ${piecesModelUrl}`, error);
                 modelLoadComplete();
            }
        );
    }

    // --- Piece Placement (Using Templates) ---
    function placePiecesFromTemplates() {
        if (Object.keys(pieceTemplates).length === 0) {
            console.error("No piece templates loaded, cannot place pieces.");
            return;
        }

        const startingPositions = [
            // Format: [Type, isWhite, boardX, boardY]
            ['Rook', true, 0, 0], ['Knight', true, 1, 0], ['Bishop', true, 2, 0], ['Queen', true, 3, 0],
            ['King', true, 4, 0], ['Bishop', true, 5, 0], ['Knight', true, 6, 0], ['Rook', true, 7, 0],
            ['Pawn', true, 0, 1], ['Pawn', true, 1, 1], ['Pawn', true, 2, 1], ['Pawn', true, 3, 1],
            ['Pawn', true, 4, 1], ['Pawn', true, 5, 1], ['Pawn', true, 6, 1], ['Pawn', true, 7, 1],
            ['Pawn', false, 0, 6], ['Pawn', false, 1, 6], ['Pawn', false, 2, 6], ['Pawn', false, 3, 6],
            ['Pawn', false, 4, 6], ['Pawn', false, 5, 6], ['Pawn', false, 6, 6], ['Pawn', false, 7, 6],
            ['Rook', false, 0, 7], ['Knight', false, 1, 7], ['Bishop', false, 2, 7], ['Queen', false, 3, 7],
            ['King', false, 4, 7], ['Bishop', false, 5, 7], ['Knight', false, 6, 7], ['Rook', false, 7, 7],
        ];

        startingPositions.forEach(([type, isWhite, boardX, boardY]) => {
            // Construct template name based on 'Type' or 'Type.001'
            let templateName;
            if (isWhite) {
                templateName = type;
            } else {
                templateName = `${type}.001`;
            }

            const templateMesh = pieceTemplates[templateName];

            if (!templateMesh) {
                console.warn(`Template mesh not found for expected name: "${templateName}". Skipping piece at ${boardX},${boardY}`);
                return;
            }

            const pieceMesh = templateMesh.clone();
            pieceMesh.material = isWhite ? whiteMaterial : blackMaterial;
            pieceMesh.castShadow = true;
            pieceMesh.receiveShadow = false;

            // --- CRITICAL PIECE ADJUSTMENTS ---
            // You MUST experiment with this scale factor!
            const pieceScaleFactor = 4.0; // Start with 4.0, but try 1.0, 10.0, 0.5 etc.
            pieceMesh.scale.set(pieceScaleFactor, pieceScaleFactor, pieceScaleFactor);
            // pieceMesh.rotation.y = Math.PI; // EXAMPLE: Uncomment and adjust if pieces face wrong way

            const worldPos = getWorldPos(boardX, boardY);

            // --- Simplified Y-Positioning ---
            // Place the piece's *origin* at Y=0 on the board square.
            // This is simpler for debugging. You might need to adjust the model's origin in Blender
            // or use the bounding box calculation later if the origin isn't at the base.
            pieceMesh.position.set(worldPos.x, 0, worldPos.z);
            // --- End Simplified Y-Positioning ---


            // --- Logging for Debugging ---
            const box = new THREE.Box3().setFromObject(pieceMesh);
            const size = box.getSize(new THREE.Vector3());
            console.log(`Placing ${isWhite ? 'White' : 'Black'} ${type}:`);
            console.log(`  - Template: ${templateName}`);
            console.log(`  - Scale Applied: ${pieceScaleFactor}`);
            console.log(`  - Calculated Size:`, size); // Check if size looks reasonable in console
            console.log(`  - Final Position:`, pieceMesh.position); // Check if X/Z look right
            // --- End Logging ---


            // Add user data
            pieceMesh.userData = {
                type: 'piece', pieceType: type, isWhite: isWhite,
                board_x: boardX, board_y: boardY,
                name: `${isWhite ? 'White' : 'Black'} ${type}`
            };

            piecesGroup.add(pieceMesh);
        });
        console.log("Finished placing pieces from templates.");
    }


    // Helper to get world position from board coordinates
    function getWorldPos(boardX, boardY) {
         return {
            x: (boardX * squareSize) - (boardDimension / 2 - squareSize / 2),
            z: (boardY * squareSize) - (boardDimension / 2 - squareSize / 2)
        };
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
        const intersects = raycaster.intersectObjects(piecesGroup.children, true);

        if (selectedPiece) {
            selectedPiece.material = originalPieceMaterial;
            selectedPiece = null; originalPieceMaterial = null;
        }

        if (intersects.length > 0) {
            let clickedMesh = null;
            for(let i = 0; i < intersects.length; i++) {
                let obj = intersects[i].object;
                if (obj instanceof THREE.Mesh && obj.userData.type === 'piece') {
                    clickedMesh = obj; break;
                }
            }
            if (clickedMesh) {
                selectedPiece = clickedMesh;
                originalPieceMaterial = selectedPiece.material;
                selectedPiece.material = selectedMaterial;
                console.log("Selected:", selectedPiece.userData.name, "at", selectedPiece.userData.board_x, selectedPiece.userData.board_y);
            }
        }
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
