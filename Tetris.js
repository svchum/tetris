class Tetris {
    constructor() {
        // Canvas elements
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.nextCanvas = document.getElementById('nextCanvas');
        this.nextCtx = this.nextCanvas.getContext('2d');
        this.holdCanvas = document.getElementById('holdCanvas');
        this.holdCtx = this.holdCanvas.getContext('2d');

        // Initialize game state
        this.resetGameState();
        
        // Bind events once
        this.setupEventListeners();
        
        // Start the game
        this.init();
    }

    resetGameState() {
        // Game board
        this.board = Array(BOARD_HEIGHT).fill().map(() => Array(BOARD_WIDTH).fill(0));
        
        // Game pieces
        this.currentPiece = null;
        this.nextPiece = null;
        this.heldType  = null;
        this.canHold = true;
        
        // Game stats
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        
        // Timing - Updated with level-based gravity
        this.dropCounter = 0;
        this.dropInterval = this.getDropInterval(1); // Start with level 1
        this.lastTime = 0;
        this.gameStartTime = 0;

        // Lock delay system
        this.lockDelayTimer = 0;
        this.lockDelayDuration = 500; // 0.5 seconds in milliseconds
        this.lockDelayActive = false;
        this.lockDelayMoves = 0;
        this.maxLockDelayMoves = 15;
        this.isGrounded = false;

        // Scoring system
        this.combo = 0;
        this.backToBackDifficult = false;
        
        // Game state
        this.gameOver = false;
        this.paused = false;
        
        // Piece generation
        this.bag = [];
        this.queue = [];
        
        // Input handling
        this.keys = {};
        this.lastMoveTime = 0;
        this.moveDelay = 100;
        this.lastDropTime = 0;
        this.softDropDelay = 50;
    }

    // Level-based gravity system (converted from G values to milliseconds)
    getDropInterval(level) {
        const gravityTable = {
            1: 0.01667,   // ~60 seconds per cell
            2: 0.021017,  // ~47.6 seconds per cell
            3: 0.026977,  // ~37.1 seconds per cell
            4: 0.035256,  // ~28.4 seconds per cell
            5: 0.04693,   // ~21.3 seconds per cell
            6: 0.06361,   // ~15.7 seconds per cell
            7: 0.0879,    // ~11.4 seconds per cell
            8: 0.1236,    // ~8.1 seconds per cell
            9: 0.1775,    // ~5.6 seconds per cell
            10: 0.2598,   // ~3.8 seconds per cell
            11: 0.388,    // ~2.6 seconds per cell
            12: 0.59,     // ~1.7 seconds per cell
            13: 0.92,     // ~1.1 seconds per cell
            14: 1.46,     // ~0.68 seconds per cell
            15: 2.36      // ~0.42 seconds per cell
        };
        
        const gravity = gravityTable[Math.min(level, 15)] || 2.36;
        // Convert G (cells per frame at 60fps) to milliseconds per cell
        return Math.max(16, 1000 / (gravity * 60)); // Minimum 16ms (60fps cap)
    }

    init() {
        // Fill initial queue
        this.fillQueue();
        
        // Spawn first piece
        this.spawnPiece();
        
        // Clear displays
        this.clearHoldDisplay();
        this.updateGameDisplay();
        
        // Start game loop
        this.gameLoop();

        this.gameStartTime = performance.now();
    }

    // === PIECE GENERATION (Classic Randomizer) ===
    fillQueue() {
        while (this.queue.length < 5) {
            if (this.bag.length === 0) {
                // Refill bag with all 7 pieces
                this.bag = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
                // Shuffle using Fisher-Yates
                for (let i = this.bag.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
                }
            }
            this.queue.push(this.bag.pop());
        }
    }

    createPiece(type) {
        const template = PIECES[type];
        return {
            type: type,
            shape: template.shape.map(row => [...row]),
            color: template.color,
            x: Math.floor(BOARD_WIDTH / 2) - Math.floor(template.shape[0].length / 2),
            y: 0
        };
    }

    spawnPiece() {
        if (this.currentPiece === null) {
            // First piece of the game
            this.currentPiece = this.createPiece(this.queue.shift());
        } else {
            // Advance queue and use previously created nextPiece
            this.currentPiece = this.nextPiece;
            this.queue.shift(); // Remove the piece that was used
        }

        this.fillQueue();         // Refill if needed
        this.generateNextPiece(); // Prepare next piece preview
        this.canHold = true;

        // Reset lock delay state
        this.lockDelayTimer = 0;
        this.lockDelayActive = false;
        this.lockDelayMoves = 0;
        this.isGrounded = false;

        if (this.hasCollision(this.currentPiece)) {
            this.gameOver = true;
            this.showGameOver();
        }
    }

    generateNextPiece() {
        this.nextPiece = this.createPiece(this.queue[0]);
        this.updateNextDisplay();
    }

    // === COLLISION DETECTION ===
    hasCollision(piece, offsetX = 0, offsetY = 0) {
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x]) {
                    const newX = piece.x + x + offsetX;
                    const newY = piece.y + y + offsetY;
                    
                    // Check boundaries
                    if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT) {
                        return true;
                    }
                    
                    // Check board collision
                    if (newY >= 0 && this.board[newY][newX]) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    // Check if piece is grounded (can't move down)
    isPieceGrounded(piece) {
        return this.hasCollision(piece, 0, 1);
    }

    // === PIECE MOVEMENT ===
    movePiece(dx, dy) {
        if (!this.currentPiece || this.gameOver || this.paused) return false;
        
        if (!this.hasCollision(this.currentPiece, dx, dy)) {
            this.currentPiece.x += dx;
            this.currentPiece.y += dy;
            
            // Reset lock delay on successful movement
            if (this.lockDelayActive && (dx !== 0 || dy !== 0)) {
                this.resetLockDelay();
            }
            
            return true;
        }
        
        // If moving down failed, handle lock delay
        if (dy > 0) {
            this.handleGrounding();
        }
        
        return false;
    }

    rotatePiece() {
        if (!this.currentPiece || this.gameOver || this.paused) return;
        
        const originalShape = this.currentPiece.shape;
        const rotated = this.rotateMatrix(originalShape);
        
        // Try rotation with wall kicks
        const kicks = [0, -1, 1, -2, 2];
        
        for (let kick of kicks) {
            this.currentPiece.shape = rotated;
            this.currentPiece.x += kick;
            
            if (!this.hasCollision(this.currentPiece)) {
                // Reset lock delay on successful rotation
                if (this.lockDelayActive) {
                    this.resetLockDelay();
                }
                return; // Successful rotation
            }
            
            this.currentPiece.x -= kick;
        }
        
        // Rotation failed, restore original shape
        this.currentPiece.shape = originalShape;
    }

    rotateMatrix(matrix) {
        const rows = matrix.length;
        const cols = matrix[0].length;
        const rotated = Array(cols).fill().map(() => Array(rows).fill(0));
        
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                rotated[x][rows - 1 - y] = matrix[y][x];
            }
        }
        
        return rotated;
    }

    hardDrop() {
        if (!this.currentPiece || this.gameOver || this.paused) return;
        
        let dropDistance = 0;
        while (this.movePiece(0, 1)) {
            dropDistance++;
        }
        
        this.score += dropDistance * 2; // Hard drop scoring
        this.lockPiece(); // Immediately lock after hard drop
    }

    holdPiece() {
        if (!this.canHold || !this.currentPiece || this.gameOver || this.paused) return;

        const held = this.heldType;
        this.heldType = this.currentPiece.type;

        if (held) {
            this.currentPiece = this.createPiece(held);
        } else {
            this.currentPiece = this.createPiece(this.queue.shift());
            this.fillQueue();
            this.generateNextPiece();
        }

        this.canHold = false;
        this.updateHoldDisplay();

        // Reset lock delay state
        this.lockDelayTimer = 0;
        this.lockDelayActive = false;
        this.lockDelayMoves = 0;
        this.isGrounded = false;
    }

    // === LOCK DELAY SYSTEM ===
    handleGrounding() {
        if (!this.isGrounded) {
            this.isGrounded = true;
            this.lockDelayActive = true;
            this.lockDelayTimer = this.lockDelayDuration;
            this.lockDelayMoves = 0;
        }
    }

    resetLockDelay() {
        if (this.lockDelayMoves < this.maxLockDelayMoves) {
            this.lockDelayTimer = this.lockDelayDuration;
            this.lockDelayMoves++;
        }
    }

    updateLockDelay(deltaTime) {
        if (!this.lockDelayActive || !this.currentPiece) return;

        // Check if piece is still grounded
        if (!this.isPieceGrounded(this.currentPiece)) {
            this.lockDelayActive = false;
            this.isGrounded = false;
            this.lockDelayTimer = 0;
            this.lockDelayMoves = 0;
            return;
        }

        // Update timer
        this.lockDelayTimer -= deltaTime;

        // Lock piece if timer expires or max moves reached
        if (this.lockDelayTimer <= 0 || this.lockDelayMoves >= this.maxLockDelayMoves) {
            this.lockPiece();
        }
    }

    // === PIECE LOCKING AND LINE CLEARING ===
    lockPiece() {
        // Place piece on board
        for (let y = 0; y < this.currentPiece.shape.length; y++) {
            for (let x = 0; x < this.currentPiece.shape[y].length; x++) {
                if (this.currentPiece.shape[y][x]) {
                    const boardY = this.currentPiece.y + y;
                    const boardX = this.currentPiece.x + x;
                    if (boardY >= 0) {
                        this.board[boardY][boardX] = this.currentPiece.color;
                    }
                }
            }
        }
        
        // Clear completed lines
        this.clearLines();
        
        // Spawn next piece
        this.spawnPiece();
    }

    clearLines() {
        let linesCleared = 0;
        
        for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
            if (this.board[y].every(cell => cell !== 0)) {
                this.board.splice(y, 1);
                this.board.unshift(Array(BOARD_WIDTH).fill(0));
                linesCleared++;
                y++; // Check the same row again
            }
        }
        
        if (linesCleared > 0) {
            this.lines += linesCleared;
            
            // Calculate score using modern Tetris scoring
            this.calculateScore(linesCleared);
            
            // Update level based on lines (faster progression)
            this.level = Math.floor(this.lines / 5) + 1; // Level up every 5 lines instead of 10
            this.dropInterval = this.getDropInterval(this.level);
            
            // Reset combo
            this.combo++;
        } else {
            // No lines cleared, reset combo
            this.combo = 0;
        }
    }

    calculateScore(linesCleared) {
        let baseScore = 0;
        let isDifficult = false;

        // Base scoring (ignoring T-spins as requested)
        switch (linesCleared) {
            case 1: // Single
                baseScore = 100;
                break;
            case 2: // Double
                baseScore = 300;
                break;
            case 3: // Triple
                baseScore = 500;
                break;
            case 4: // Tetris
                baseScore = 800;
                isDifficult = true;
                break;
        }

        // Apply level multiplier
        let lineScore = baseScore * this.level;

        // Back-to-back bonus for difficult clears
        if (isDifficult) {
            if (this.backToBackDifficult) {
                lineScore = Math.floor(lineScore * 1.5);
            }
            this.backToBackDifficult = true;
        } else {
            this.backToBackDifficult = false;
        }

        // Combo bonus
        if (this.combo > 1) {
            const comboScore = 50 * (this.combo - 1) * this.level;
            lineScore += comboScore;
        }

        this.score += lineScore;
    }

    // === GHOST PIECE ===
    getGhostPiece() {
        if (!this.currentPiece) return null;
        
        const ghost = {
            ...this.currentPiece,
            shape: this.currentPiece.shape
        };
        
        while (!this.hasCollision(ghost, 0, 1)) {
            ghost.y++;
        }
        
        return ghost;
    }

    // === RENDERING ===
    draw() {
        this.clearCanvas(this.ctx, this.canvas);
        
        // Draw board
        this.drawBoard();
        
        // Draw ghost piece
        if (this.currentPiece) {
            this.drawGhostPiece();
        }
        
        // Draw current piece
        if (this.currentPiece) {
            this.drawPiece(this.ctx, this.currentPiece, BLOCK_SIZE);
        }
    }

    drawBoard() {
        for (let y = 0; y < BOARD_HEIGHT; y++) {
            for (let x = 0; x < BOARD_WIDTH; x++) {
                if (this.board[y][x]) {
                    this.ctx.fillStyle = this.board[y][x];
                    this.ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                    this.ctx.strokeStyle = '#fff';
                    this.ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                }
            }
        }
    }

    drawGhostPiece() {
        const ghost = this.getGhostPiece();
        if (!ghost || ghost.y === this.currentPiece.y) return;
        
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        
        for (let y = 0; y < ghost.shape.length; y++) {
            for (let x = 0; x < ghost.shape[y].length; x++) {
                if (ghost.shape[y][x]) {
                    const drawX = (ghost.x + x) * BLOCK_SIZE;
                    const drawY = (ghost.y + y) * BLOCK_SIZE;
                    this.ctx.fillRect(drawX, drawY, BLOCK_SIZE, BLOCK_SIZE);
                    this.ctx.strokeRect(drawX, drawY, BLOCK_SIZE, BLOCK_SIZE);
                }
            }
        }
    }

    drawPiece(ctx, piece, blockSize) {
        ctx.fillStyle = piece.color;
        ctx.strokeStyle = '#fff';
        
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x]) {
                    const drawX = piece.x * blockSize + x * blockSize;
                    const drawY = piece.y * blockSize + y * blockSize;
                    ctx.fillRect(drawX, drawY, blockSize, blockSize);
                    ctx.strokeRect(drawX, drawY, blockSize, blockSize);
                }
            }
        }
    }

    clearCanvas(ctx, canvas) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // === UI UPDATES ===
    updateNextDisplay() {
        this.clearCanvas(this.nextCtx, this.nextCanvas);
        
        const displayQueue = this.queue.slice(0, 5);
        displayQueue.forEach((type, index) => {
            const piece = PIECES[type];
            const offsetX = (this.nextCanvas.width - piece.shape[0].length * 20) / 2;
            const offsetY = index * 60 + 10;
            
            this.nextCtx.fillStyle = piece.color;
            this.nextCtx.strokeStyle = '#fff';
            
            for (let y = 0; y < piece.shape.length; y++) {
                for (let x = 0; x < piece.shape[y].length; x++) {
                    if (piece.shape[y][x]) {
                        const drawX = offsetX + x * 20;
                        const drawY = offsetY + y * 20;
                        this.nextCtx.fillRect(drawX, drawY, 20, 20);
                        this.nextCtx.strokeRect(drawX, drawY, 20, 20);
                    }
                }
            }
        });
    }

    updateHoldDisplay() {
        this.clearCanvas(this.holdCtx, this.holdCanvas);
        
        if (this.heldType) {
            const piece = PIECES[this.heldType];
            const offsetX = (this.holdCanvas.width - piece.shape[0].length * 20) / 2;
            const offsetY = (this.holdCanvas.height - piece.shape.length * 20) / 2;
            
            this.holdCtx.fillStyle = piece.color;
            this.holdCtx.strokeStyle = '#fff';
            
            for (let y = 0; y < piece.shape.length; y++) {
                for (let x = 0; x < piece.shape[y].length; x++) {
                    if (piece.shape[y][x]) {
                        const drawX = offsetX + x * 20;
                        const drawY = offsetY + y * 20;
                        this.holdCtx.fillRect(drawX, drawY, 20, 20);
                        this.holdCtx.strokeRect(drawX, drawY, 20, 20);
                    }
                }
            }
        }
    }

    clearHoldDisplay() {
        this.clearCanvas(this.holdCtx, this.holdCanvas);
    }

    updateGameDisplay() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('lines').textContent = this.lines;
        document.getElementById('level').textContent = this.level;

        const secondsElapsed = Math.floor((performance.now() - this.gameStartTime) / 1000);
        document.getElementById('time').textContent = secondsElapsed;
        
        // Add combo display if element exists
        const comboElement = document.getElementById('combo');
        if (comboElement) {
            comboElement.textContent = this.combo > 1 ? `Combo: ${this.combo}` : '';
        }
    }

    showGameOver() {
        document.getElementById('gameOver').style.display = 'block';
        document.getElementById('finalScore').textContent = this.score;
    }

    // === GAME CONTROL ===
    togglePause() {
        if (this.gameOver) return;
        
        this.paused = !this.paused;
        const pauseScreen = document.getElementById('pauseScreen');
        const pauseBtn = document.getElementById('pauseBtn');
        
        if (this.paused) {
            pauseScreen.style.display = 'block';
            pauseBtn.textContent = 'Resume (P)';
        } else {
            pauseScreen.style.display = 'none';
            pauseBtn.textContent = 'Pause (P)';
        }
    }

    restart() {
        // Hide UI elements
        document.getElementById('gameOver').style.display = 'none';
        document.getElementById('pauseScreen').style.display = 'none';
        document.getElementById('pauseBtn').textContent = 'Pause (P)';
        
        // Reset all game state
        this.resetGameState();
        
        // Restart the game
        this.init();
    }

    // === GAME LOOP ===
    gameLoop(currentTime = 0) {
        if (this.gameOver) return;
        
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        if (!this.paused) {
            this.update(deltaTime);
            this.draw();
        }
        
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    update(deltaTime) {
        this.handleInput(deltaTime);
        
        // Update lock delay
        this.updateLockDelay(deltaTime);
        
        // Auto drop (only if not in lock delay)
        if (!this.lockDelayActive) {
            this.dropCounter += deltaTime;
            if (this.dropCounter >= this.dropInterval) {
                this.movePiece(0, 1);
                this.dropCounter = 0;
            }
        }
        
        this.updateGameDisplay();
    }

    handleInput(deltaTime) {
        const now = performance.now();
        
        // Horizontal movement
        if ((this.keys['ArrowLeft'] || this.keys['ArrowRight']) && 
            now - this.lastMoveTime > this.moveDelay) {
            
            if (this.keys['ArrowLeft']) this.movePiece(-1, 0);
            if (this.keys['ArrowRight']) this.movePiece(1, 0);
            this.lastMoveTime = now;
        }
        
        // Soft drop
        if (this.keys['ArrowDown'] && now - this.lastDropTime > this.softDropDelay) {
            if (this.movePiece(0, 1)) {
                this.score += 1; // Soft drop scoring
            }
            this.lastDropTime = now;
        }
    }

    // === EVENT HANDLING ===
    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        document.getElementById('pauseBtn').addEventListener('click', () => {
            this.togglePause();
        });
    }

    handleKeyDown(e) {
        const gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'c', 'C', 'p', 'P', 'r', 'R'];
        if (gameKeys.includes(e.key)) {
            e.preventDefault(); // prevent scrolling for game keys
        }

        // Game over restart
        if (this.gameOver && (e.key === 'r' || e.key === 'R')) {
            this.restart();
            return;
        }

        // Pause toggle
        if (e.key === 'p' || e.key === 'P') {
            this.togglePause();
            return;
        }

        if (this.gameOver || this.paused) return;

        this.keys[e.key] = true;

        // Handle single-press actions
        switch (e.key) {
            case 'ArrowUp':
                this.rotatePiece();
                break;
            case ' ':
                this.hardDrop();
                break;
            case 'c':
            case 'C':
                this.holdPiece();
                break;
        }
    }

    handleKeyUp(e) {
        this.keys[e.key] = false;
    }
}