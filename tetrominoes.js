// Tetris pieces (tetrominoes) definitions
// Each piece has a shape matrix and color
const PIECES = {
    I: {// cyan
        shape: [
            [1,1,1,1]
        ],
        color: '#79f1d5'
    },
    O: {// yellow
        shape: [
            [1,1],
            [1,1]
        ],
        color: '#f9f97e'
    },
    T: {//  purple
        shape: [
            [0,1,0],
            [1,1,1]
        ],
        color: '#9b93f6'
    },
    S: {//green
        shape: [
            [0,1,1],
            [1,1,0]
        ],
        color: '#8DDD63'
    },
    Z: {//red
        shape: [
            [1,1,0],
            [0,1,1]
        ],
        color: '#fd414b'
    },
    J: {//blue
        shape: [
            [1,0,0],
            [1,1,1]
        ],
        color: '#6378fb'
    },
    L: { //orange
        shape: [
            [0,0,1],
            [1,1,1]
        ],
        color: '#f67a4e'
    }
};

// Game constants
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const BLOCK_SIZE = 30;