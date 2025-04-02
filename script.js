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
                        // Apply default material if needed
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
                const scaleFactor = desiredBoardSize / Math.max(size.x, size.z); // Assumes board lies on XZ plane

                object.scale.set(scaleFactor, scaleFactor, scaleFactor);

                const scaledBox = new THREE.Box3().setFromObject(object);
                const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

                // Adjust position to center and set bottom at Y=0
                object.position.x = -scaledCenter.x;
                object.position.y = -scaledBox.min.y; // Set bottom of the board at Y=0
                object.position.z = -scaledCenter.z;

                // object.rotation.x = -Math.PI / 2; // Example if needed

                boardGroup.add(object);
                console.log("Board model processed and added to scene.");
                modelLoadComplete();
            },
            undefined, // onProgress
            (error) => { // onError
                console.error(`Failed to load chessboard model from: ${boardModelUrl}`, error);
                // Add fallback plane
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
                // --- ASSUMPTION ---
                // Assume the loaded 'object' (THREE.Group) contains meshes named like:
                // 'White_Pawn', 'Black_Pawn', 'White_Rook', 'Black_Knight', 'White_King', etc.
                // Store these meshes as templates.
                object.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        console.log(`Found mesh in pieces file: ${child.name}`);
                        // Store the original mesh as a template
                        // We will clone these later for actual placement
                        pieceTemplates[child.name] = child;
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
            // White Back Row
            ['Rook', true, 0, 0], ['Knight', true, 1, 0], ['Bishop', true, 2, 0], ['Queen', true, 3, 0],
            ['King', true, 4, 0], ['Bishop', true, 5, 0], ['Knight', true, 6, 0], ['Rook', true, 7, 0],
            // White Pawns
            ['Pawn', true, 0, 1], ['Pawn', true, 1, 1], ['Pawn', true, 2, 1], ['Pawn', true, 3, 1],
            ['Pawn', true, 4, 1], ['Pawn', true, 5, 1], ['Pawn', true, 6, 1], ['Pawn', true, 7, 1],
            // Black Pawns
            ['Pawn', false, 0, 6], ['Pawn', false, 1, 6], ['Pawn', false, 2, 6], ['Pawn', false, 3, 6],
            ['Pawn', false, 4, 6], ['Pawn', false, 5, 6], ['Pawn', false, 6, 6], ['Pawn', false, 7, 6],
            // Black Back Row
            ['Rook', false, 0, 7], ['Knight', false, 1, 7], ['Bishop', false, 2, 7], ['Queen', false, 3, 7],
            ['King', false, 4, 7], ['Bishop', false, 5, 7], ['Knight', false, 6, 7], ['Rook', false, 7, 7],
        ];

        startingPositions.forEach(([type, isWhite, boardX, boardY]) => {
            const colorName = isWhite ? 'White' : 'Black';
            // --- ASSUMPTION: Mesh names in OBJ are like 'White_Pawn', 'Black_Rook' ---
            // --- You MUST adjust this if your model names differ ---
            const templateName = `${colorName}_${type}`;
            const templateMesh = pieceTemplates[templateName];

            if (!templateMesh) {
                console.warn(`Template mesh not found for name: ${templateName}. Skipping piece at ${boardX},${boardY}`);
                return;
            }

            // Clone the template mesh
            const pieceMesh = templateMesh.clone();

            // Assign correct material
            pieceMesh.material = isWhite ? whiteMaterial : blackMaterial;
            pieceMesh.castShadow = true;
            pieceMesh.receiveShadow = false;

            // --- Piece Adjustments (EXAMPLE - TUNE THESE) ---
            // You will likely need to adjust scale and potentially rotation/position offset
            // depending on how the models were exported relative to each other in chess.obj
            const pieceScaleFactor = 4.0; // EXAMPLE: Adjust scale
            pieceMesh.scale.set(pieceScaleFactor, pieceScaleFactor, pieceScaleFactor);
            // pieceMesh.rotation.y = Math.PI; // EXAMPLE: Rotate if needed

            // Calculate position
            const worldPos = getWorldPos(boardX, boardY);
            const box = new THREE.Box3().setFromObject(pieceMesh); // Use bounding box of scaled clone
            const size = box.getSize(new THREE.Vector3());
            pieceMesh.position.set(worldPos.x, size.y / 2, worldPos.z); // Position base approx on board

             // Add user data for identification during clicks
            pieceMesh.userData = {
                type: 'piece',
                pieceType: type,
                isWhite: isWhite,
                board_x: boardX,
                board_y: boardY,
                name: `${colorName} ${type}` // e.g., "White Pawn"
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

        // Intersect with the pieces group (recursive needed for groups from OBJ)
        const intersects = raycaster.intersectObjects(piecesGroup.children, true);

        // Reset previously selected piece material
        if (selectedPiece) {
            // The selectedPiece is the mesh itself now
            selectedPiece.material = originalPieceMaterial;
            selectedPiece = null;
            originalPieceMaterial = null;
        }

        if (intersects.length > 0) {
            // Find the closest intersected object that has our piece user data
            let clickedMesh = null;
            for(let i = 0; i < intersects.length; i++) {
                let obj = intersects[i].object;
                 // Check if the object itself or its parent has the userData
                 // (depending on how OBJ groups things)
                 // We assigned userData directly to the cloned mesh.
                if (obj instanceof THREE.Mesh && obj.userData.type === 'piece') {
                    clickedMesh = obj;
                    break; // Found the piece mesh
                }
                 // Optional: Check parent if needed, but direct assignment is cleaner
                 // while(obj.parent && !(obj instanceof THREE.Scene)){
                 //    if(obj.userData.type === 'piece'){
                 //       clickedMesh = obj;
                 //       break;
                 //    }
                 //    obj = obj.parent;
                 // }
                 // if(clickedMesh) break;
            }

            if (clickedMesh) {
                selectedPiece = clickedMesh; // Store the mesh
                originalPieceMaterial = selectedPiece.material; // Store original material
                selectedPiece.material = selectedMaterial; // Highlight selected piece

                console.log("Selected:", selectedPiece.userData.name, "at", selectedPiece.userData.board_x, selectedPiece.userData.board_y);

                // TODO: Implement move logic here
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
