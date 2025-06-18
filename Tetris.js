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
        
        // Timing
        this.dropCounter = 0;
        this.dropInterval = 1000;
        this.lastTime = 0;
        this.gameStartTime = 0;

        
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
            this.queue.shift(); // ✅ REMOVE the piece that was used
        }

        this.fillQueue();         // Refill if needed
        this.generateNextPiece(); // Prepare next piece preview
        this.canHold = true;

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

    // === PIECE MOVEMENT ===
    movePiece(dx, dy) {
        if (!this.currentPiece || this.gameOver || this.paused) return false;
        
        if (!this.hasCollision(this.currentPiece, dx, dy)) {
            this.currentPiece.x += dx;
            this.currentPiece.y += dy;
            return true;
        }
        
        // If moving down failed, lock the piece
        if (dy > 0) {
            this.lockPiece();
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
        
        this.score += dropDistance * 2;
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
            const linePoints = [0, 40, 100, 300, 1200];
            this.score += linePoints[linesCleared] * this.level;
            this.level = Math.floor(this.lines / 10) + 1;
            this.dropInterval = Math.max(50, 1000 - (this.level - 1) * 50);
        }
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
        
        // Auto drop
        this.dropCounter += deltaTime;
        if (this.dropCounter >= this.dropInterval) {
            this.movePiece(0, 1);
            this.dropCounter = 0;
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
                this.score += 1;
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
                e.preventDefault();
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