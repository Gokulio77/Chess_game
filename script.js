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

    loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => { /* ... */ };

    loadingManager.onLoad = () => {
        console.log('Loading complete (all attempts finished). Placing pieces...');
        if (loadingStatusElement) loadingStatusElement.textContent = 'Models loaded. Placing pieces...';
        placePiecesFromTemplates();
        setTimeout(() => {
            if (loadingStatusElement) loadingStatusElement.style.display = 'none';
        }, 2000);
    };

    loadingManager.onError = (url) => {
        console.error(`There was an error loading ${url}`);
        if (loadingStatusElement) loadingStatusElement.textContent = `Error loading: ${url}`;
        modelLoadComplete();
    };

    function modelLoadComplete() {
        modelsLoaded++;
        if (loadingStatusElement) {
            loadingStatusElement.textContent = `Loading... (${modelsLoaded}/${modelsToLoad})`;
        }
        if (modelsLoaded === modelsToLoad) {
             setTimeout(() => loadingManager.onLoad(), 0);
        }
    }

    // --- Initialization ---
    function init() {
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xeeeeee);
        const canvas = document.getElementById('chessCanvas');
        camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 1, 1000);
        camera.position.set(0, boardDimension * 0.8, boardDimension * 1.1);
        camera.lookAt(0, 0, 0);
        renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
        renderer.setSize(canvas.clientWidth, canvas.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
        directionalLight.position.set(40, 60, 30);
        directionalLight.castShadow = true;
        // ... rest of light setup ...
        scene.add(directionalLight);
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        // ... rest of controls setup ...
        controls.update();
        boardGroup = new THREE.Group();
        piecesGroup = new THREE.Group();
        scene.add(boardGroup);
        scene.add(piecesGroup);
        modelsLoaded = 0;
        if (loadingStatusElement) loadingStatusElement.textContent = `Loading... (0/${modelsToLoad})`;
        loadChessboardModel();
        loadPieceModels();
        window.addEventListener('resize', onWindowResize, false);
        renderer.domElement.addEventListener('click', onMouseClick, false);
        animate();
    }

    // --- Chessboard Model Loading ---
    function loadChessboardModel() {
        const boardModelUrl = "https://gokulio77.github.io/Chess_game/models/chessboard.obj"; // User provided URL
        console.log(`Attempting to load board model from: ${boardModelUrl}`);
        objLoader.load( boardModelUrl, (object) => {
                console.log("Chessboard model loaded successfully.");
                object.traverse((child) => { /* ... apply material, shadows ... */
                     if (child instanceof THREE.Mesh) {
                        if (!child.material || Array.isArray(child.material)) { child.material = boardMaterial; }
                        child.receiveShadow = true; child.castShadow = false;
                    }
                });
                // --- Board Adjustments ---
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
                // --- End Board Adjustments ---
                boardGroup.add(object);
                console.log("Board model processed and added to scene.");
                modelLoadComplete();
            },
            undefined,
            (error) => { /* ... error handling ... */
                console.error(`Failed to load chessboard model from: ${boardModelUrl}`, error);
                const fallbackGeo = new THREE.PlaneGeometry(boardDimension, boardDimension);
                const fallbackMat = new THREE.MeshStandardMaterial({color: 0x888888});
                const fallbackPlane = new THREE.Mesh(fallbackGeo, fallbackMat);
                fallbackPlane.rotation.x = -Math.PI / 2; fallbackPlane.receiveShadow = true;
                boardGroup.add(fallbackPlane); console.log("Added fallback plane for board.");
                modelLoadComplete();
             }
        );
    }

    // --- Piece Models Loading (Single File) ---
    function loadPieceModels() {
        const piecesModelUrl = "https://gokulio77.github.io/Chess_game/models/chess.obj"; // User provided URL
        console.log(`Attempting to load pieces model from: ${piecesModelUrl}`);
        objLoader.load( piecesModelUrl, (object) => {
                console.log("Pieces model file loaded successfully.");
                object.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        const meshName = child.name.trim();
                        if (meshName) {
                           console.log(`Found mesh template: ${meshName}`);
                           if (!child.geometry || !child.geometry.attributes.position || child.geometry.attributes.position.count === 0) {
                               console.warn(`   - WARNING: Template mesh "${meshName}" has missing or empty geometry!`);
                           }
                           pieceTemplates[meshName] = child;
                        } else { console.warn("Found mesh with empty name, skipping template storage."); }
                    }
                });
                 console.log("Piece templates extracted:", Object.keys(pieceTemplates));
                 modelLoadComplete();
            },
            undefined,
            (error) => { /* ... error handling ... */
                 console.error(`Failed to load pieces model from: ${piecesModelUrl}`, error);
                 modelLoadComplete();
             }
        );
    }

    // --- Piece Placement (Using Templates) ---
    function placePiecesFromTemplates() {
        if (Object.keys(pieceTemplates).length === 0) { /* ... error ... */ return; }

        const startingPositions = [ /* ... same positions array ... */
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
            let templateName;
            if (isWhite) { templateName = type; } else { templateName = `${type}.001`; }
            const templateMesh = pieceTemplates[templateName];

            if (!templateMesh) { console.warn(/* ... */); return; }

            // --- Log Template Geometry ---
            console.log(`Processing Template: ${templateName}`);
            if (templateMesh.geometry && templateMesh.geometry.attributes.position) {
                console.log(`  - Template Geo OK. Position count: ${templateMesh.geometry.attributes.position.count}`);
            } else { console.error(/* ... */); return; }
            // --- End Log ---

            const pieceMesh = templateMesh.clone();

            // --- Check Cloned Geometry ---
             if (!pieceMesh.geometry || !pieceMesh.geometry.attributes.position || pieceMesh.geometry.attributes.position.count === 0) {
                console.error(`  - ERROR: Cloned mesh for ${templateName} has missing or empty geometry after clone!`); return;
            } else { console.log(`  - Cloned Geo OK. Position count: ${pieceMesh.geometry.attributes.position.count}`); }
            // --- End Check ---

            pieceMesh.material = isWhite ? whiteMaterial : blackMaterial;
            pieceMesh.castShadow = true;
            pieceMesh.receiveShadow = false;

            // --- Piece Scale Adjustment ---
            // This scale factor likely needs tuning based on your specific models.
            const pieceScaleFactor = 40.0; // Keep adjusting this value!
            pieceMesh.scale.set(pieceScaleFactor, pieceScaleFactor, pieceScaleFactor);
            // pieceMesh.rotation.y = Math.PI; // EXAMPLE: Uncomment/adjust if needed

            const worldPos = getWorldPos(boardX, boardY);

            // --- UPDATED Y-Positioning using Bounding Box ---
            // Calculate bounding box AFTER scaling
            const box = new THREE.Box3().setFromObject(pieceMesh);
            // Calculate the offset needed to lift the piece so its bottom is at Y=0
            // box.min.y is the lowest point of the mesh relative to its origin.
            // If origin is at the base, min.y is 0. If origin is centered, min.y is negative.
            // We want to lift the piece by the negative of its lowest point.
            const yPositionOffset = -box.min.y;
            pieceMesh.position.set(worldPos.x, yPositionOffset, worldPos.z);
            // --- End UPDATED Y-Positioning ---


            // --- Logging for Debugging ---
            const size = box.getSize(new THREE.Vector3()); // Get size from the same box
            console.log(`  - Scale Applied: ${pieceScaleFactor}`);
            console.log(`  - Calculated Size: x=${size.x.toFixed(2)}, y=${size.y.toFixed(2)}, z=${size.z.toFixed(2)}`);
            // Log the calculated Y offset and final position
            console.log(`  - BBox Min Y: ${box.min.y.toFixed(2)}, Calculated Y Offset: ${yPositionOffset.toFixed(2)}`);
            console.log(`  - Final Position: x=${pieceMesh.position.x.toFixed(2)}, y=${pieceMesh.position.y.toFixed(2)}, z=${pieceMesh.position.z.toFixed(2)}`);
            // --- End Logging ---

            pieceMesh.userData = {
                type: 'piece', pieceType: type, isWhite: isWhite,
                board_x: boardX, board_y: boardY,
                name: `${isWhite ? 'White' : 'Black'} ${type}`
            };

            piecesGroup.add(pieceMesh);
        });
        console.log("Finished placing pieces from templates.");
    }

    function getWorldPos(boardX, boardY) { /* ... same ... */
         return {
            x: (boardX * squareSize) - (boardDimension / 2 - squareSize / 2),
            z: (boardY * squareSize) - (boardDimension / 2 - squareSize / 2)
        };
    }
    function onWindowResize() { /* ... same ... */
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
    function onMouseClick(event) { /* ... same ... */
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
    function animate() { /* ... same ... */
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
     }

    init();
    onWindowResize();

});
