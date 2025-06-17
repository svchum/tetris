class Tetris {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.nextCanvas = document.getElementById('nextCanvas');
        this.nextCtx = this.nextCanvas.getContext('2d');
        this.holdCanvas = document.getElementById('holdCanvas');
        this.holdCtx = this.holdCanvas.getContext('2d');

        this.board = Array(BOARD_HEIGHT).fill().map(() => Array(BOARD_WIDTH).fill(0));
        this.currentPiece = null;
        this.nextPiece = null;
        this.holdPiece = null;
        this.canHold = true;
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.dropCounter = 0;
        this.dropInterval = 1000;
        this.gameOver = false;
        this.paused = false;
        this.keys = {};
        
        // Soft drop timing
        this.softDropCounter = 0;
        this.softDropInterval = 50; // Slower soft drop (was much faster)
        
        this.init();
    }

    init() {
        this.spawnPiece();
        this.spawnNextPiece();
        this.updateDisplay();
        this.gameLoop();
        this.bindEvents();
    }

    spawnPiece() {
        if (this.nextPiece) {
            this.currentPiece = this.nextPiece;
            this.spawnNextPiece();
        } else {
            this.currentPiece = this.createPiece();
        }
        
        this.currentPiece.x = Math.floor(BOARD_WIDTH / 2) - Math.floor(this.currentPiece.shape[0].length / 2);
        this.currentPiece.y = 0;

        if (this.collision()) {
            this.gameOver = true;
            document.getElementById('gameOver').style.display = 'block';
            document.getElementById('finalScore').textContent = this.score;
        }
    }

    spawnNextPiece() {
        this.nextPiece = this.createPiece();
        this.drawNext();
    }

    createPiece() {
        const pieces = Object.keys(PIECES);
        const randomPiece = pieces[Math.floor(Math.random() * pieces.length)];
        const piece = PIECES[randomPiece];
        
        return {
            shape: piece.shape.map(row => [...row]), // Deep copy
            color: piece.color,
            x: 0,
            y: 0,
            type: randomPiece
        };
    }

    collision(piece = this.currentPiece) {
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x]) {
                    const newX = piece.x + x;
                    const newY = piece.y + y;
                    
                    if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT) {
                        return true;
                    }
                    
                    if (newY >= 0 && this.board[newY][newX]) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    merge() {
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
    }

    clearLines() {
        let linesCleared = 0;
        for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
            if (this.board[y].every(cell => cell !== 0)) {
                this.board.splice(y, 1);
                this.board.unshift(Array(BOARD_WIDTH).fill(0));
                linesCleared++;
                y++; // Check the same line again
            }
        }
        
        if (linesCleared > 0) {
            this.lines += linesCleared;
            this.score += linesCleared * 100 * this.level;
            this.level = Math.floor(this.lines / 10) + 1;
            this.dropInterval = Math.max(50, 1000 - (this.level - 1) * 50);
        }
    }

    rotate() {
        const shape = this.currentPiece.shape;
        const rotated = [];
        
        // Rotate the matrix 90 degrees clockwise
        for (let i = 0; i < shape[0].length; i++) {
            rotated[i] = [];
            for (let j = shape.length - 1; j >= 0; j--) {
                rotated[i][shape.length - 1 - j] = shape[j][i];
            }
        }
        
        const originalShape = this.currentPiece.shape;
        this.currentPiece.shape = rotated;
        
        // Wall kicks - try different positions
        const kicks = [0, 1, -1, 2, -2];
        for (let kick of kicks) {
            this.currentPiece.x += kick;
            if (!this.collision()) {
                return;
            }
            this.currentPiece.x -= kick;
        }
        
        // If no position works, revert to original
        this.currentPiece.shape = originalShape;
    }

    move(dx, dy) {
        this.currentPiece.x += dx;
        this.currentPiece.y += dy;
        
        if (this.collision()) {
            this.currentPiece.x -= dx;
            this.currentPiece.y -= dy;
            
            if (dy > 0) {
                this.merge();
                this.clearLines();
                this.canHold = true;
                this.spawnPiece();
            }
            return false;
        }
        return true;
    }

    hardDrop() {
        while (this.move(0, 1)) {}
        this.score += 2;
    }

    // Calculate ghost piece position (where piece will land)
    getGhostPiece() {
        const ghost = {
            shape: this.currentPiece.shape,
            x: this.currentPiece.x,
            y: this.currentPiece.y,
            color: this.currentPiece.color
        };
        
        while (!this.collision(ghost)) {
            ghost.y++;
        }
        ghost.y--; // Move back to last valid position
        
        return ghost;
    }

    hold() {
        if (!this.canHold) return;
        
        if (this.holdPiece) {
            const temp = this.holdPiece;
            this.holdPiece = {
                type: this.currentPiece.type,
                shape: PIECES[this.currentPiece.type].shape.map(row => [...row]),
                color: this.currentPiece.color
            };
            this.currentPiece = this.createPiece();
            this.currentPiece.type = temp.type;
            this.currentPiece.shape = temp.shape.map(row => [...row]);
            this.currentPiece.color = temp.color;
        } else {
            this.holdPiece = {
                type: this.currentPiece.type,
                shape: PIECES[this.currentPiece.type].shape.map(row => [...row]),
                color: this.currentPiece.color
            };
            this.spawnPiece();
        }
        
        this.currentPiece.x = Math.floor(BOARD_WIDTH / 2) - Math.floor(this.currentPiece.shape[0].length / 2);
        this.currentPiece.y = 0;
        this.canHold = false;
        this.drawHold();
    }

    togglePause() {
        this.paused = !this.paused;
        const pauseScreen = document.getElementById('pauseScreen');
        const pauseBtn = document.getElementById('pauseBtn');

        if (this.paused) {
            pauseScreen.style.display = 'block';
            pauseBtn.textContent = 'Resume (P)';
            cancelAnimationFrame(this.lastFrame); // Stop animation
        } else {
            pauseScreen.style.display = 'none';
            pauseBtn.textContent = 'Pause (P)';
            this.dropCounter = 0;
            this.softDropCounter = 0;
            this.lastUpdate = performance.now(); // Reset time tracking
            this.lastFrame = requestAnimationFrame(() => this.gameLoop());
        }
    }
    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw board
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
        
        // Draw ghost piece (landing indicator)
        if (this.currentPiece) {
            const ghost = this.getGhostPiece();
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
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
        
        // Draw current piece
        if (this.currentPiece) {
            this.ctx.fillStyle = this.currentPiece.color;
            for (let y = 0; y < this.currentPiece.shape.length; y++) {
                for (let x = 0; x < this.currentPiece.shape[y].length; x++) {
                    if (this.currentPiece.shape[y][x]) {
                        const drawX = (this.currentPiece.x + x) * BLOCK_SIZE;
                        const drawY = (this.currentPiece.y + y) * BLOCK_SIZE;
                        this.ctx.fillRect(drawX, drawY, BLOCK_SIZE, BLOCK_SIZE);
                        this.ctx.strokeStyle = '#fff';
                        this.ctx.strokeRect(drawX, drawY, BLOCK_SIZE, BLOCK_SIZE);
                    }
                }
            }
        }
    }

    drawNext() {
        this.nextCtx.fillStyle = '#000';
        this.nextCtx.fillRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);
        
        if (this.nextPiece) {
            this.nextCtx.fillStyle = this.nextPiece.color;
            const offsetX = (this.nextCanvas.width - this.nextPiece.shape[0].length * 20) / 2;
            const offsetY = (this.nextCanvas.height - this.nextPiece.shape.length * 20) / 2;
            
            for (let y = 0; y < this.nextPiece.shape.length; y++) {
                for (let x = 0; x < this.nextPiece.shape[y].length; x++) {
                    if (this.nextPiece.shape[y][x]) {
                        this.nextCtx.fillRect(offsetX + x * 20, offsetY + y * 20, 20, 20);
                        this.nextCtx.strokeStyle = '#fff';
                        this.nextCtx.strokeRect(offsetX + x * 20, offsetY + y * 20, 20, 20);
                    }
                }
            }
        }
    }

    drawHold() {
        this.holdCtx.fillStyle = '#000';
        this.holdCtx.fillRect(0, 0, this.holdCanvas.width, this.holdCanvas.height);
        
        if (this.holdPiece) {
            this.holdCtx.fillStyle = this.holdPiece.color;
            const shape = this.holdPiece.shape;
            const offsetX = (this.holdCanvas.width - shape[0].length * 20) / 2;
            const offsetY = (this.holdCanvas.height - shape.length * 20) / 2;
            
            for (let y = 0; y < shape.length; y++) {
                for (let x = 0; x < shape[y].length; x++) {
                    if (shape[y][x]) {
                        this.holdCtx.fillRect(offsetX + x * 20, offsetY + y * 20, 20, 20);
                        this.holdCtx.strokeStyle = '#fff';
                        this.holdCtx.strokeRect(offsetX + x * 20, offsetY + y * 20, 20, 20);
                    }
                }
            }
        }
    }

    updateDisplay() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('lines').textContent = this.lines;
        document.getElementById('level').textContent = this.level;
    }
gameLoop() {
    if (this.gameOver) return;
    if (this.paused) {
        this.lastFrame = requestAnimationFrame(() => this.gameLoop());
        return;
    }

    const now = performance.now();
    const delta = now - (this.lastUpdate || now);
    this.lastUpdate = now;

    this.dropCounter += delta;
    this.softDropCounter += delta;

    // Soft drop
    if (this.keys['ArrowDown'] && this.softDropCounter > this.softDropInterval) {
        if (this.move(0, 1)) {
            this.score += 1;
        }
        this.softDropCounter = 0;
    }

    // Regular drop
    if (!this.keys['ArrowDown'] && this.dropCounter > this.dropInterval) {
        this.move(0, 1);
        this.dropCounter = 0;
    }

    this.draw();
    this.updateDisplay();
    this.lastFrame = requestAnimationFrame(() => this.gameLoop());
}

    bindEvents() {
        document.addEventListener('keydown', (e) => {
            if (this.gameOver && e.key === 'r') {
                this.restart();
                return;
            }
            
            if (e.key === 'p' || e.key === 'P') {
                if (!this.gameOver) {
                    this.togglePause();
                }
                return;
            }
            
            if (this.gameOver || this.paused) return;
            
            this.keys[e.key] = true;
            
            switch(e.key) {
                case 'ArrowLeft':
                    this.move(-1, 0);
                    break;
                case 'ArrowRight':
                    this.move(1, 0);
                    break;
                case 'ArrowUp':
                    this.rotate();
                    break;
                case ' ':
                    e.preventDefault();
                    this.hardDrop();
                    break;
                case 'c':
                case 'C':
                    this.hold();
                    break;
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });

        // Pause button click handler
        document.getElementById('pauseBtn').addEventListener('click', () => {
            if (!this.gameOver) {
                this.togglePause();
            }
        });
    }

    restart() {
        this.board = Array(BOARD_HEIGHT).fill().map(() => Array(BOARD_WIDTH).fill(0));
        this.currentPiece = null;
        this.nextPiece = null;
        this.holdPiece = null;
        this.canHold = true;
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.dropCounter = 0;
        this.dropInterval = 1000;
        this.gameOver = false;
        this.paused = false;
        document.getElementById('gameOver').style.display = 'none';
        document.getElementById('pauseScreen').style.display = 'none';
        document.getElementById('pauseBtn').textContent = 'Pause (P)';
        
        this.holdCtx.fillStyle = '#000';
        this.holdCtx.fillRect(0, 0, this.holdCanvas.width, this.holdCanvas.height);
        
        this.init();
    }
}