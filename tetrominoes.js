// Tetris pieces (tetrominoes) definitions
// Each piece has a shape matrix and color
const PIECES = {
    I: {
        shape: [
            [1,1,1,1]
        ],
        color: '#00f0f0'
    },
    O: {
        shape: [
            [1,1],
            [1,1]
        ],
        color: '#f0f000'
    },
    T: {
        shape: [
            [0,1,0],
            [1,1,1]
        ],
        color: '#a000f0'
    },
    S: {
        shape: [
            [0,1,1],
            [1,1,0]
        ],
        color: '#00f000'
    },
    Z: {
        shape: [
            [1,1,0],
            [0,1,1]
        ],
        color: '#f00000'
    },
    J: {
        shape: [
            [1,0,0],
            [1,1,1]
        ],
        color: '#0000f0'
    },
    L: {
        shape: [
            [0,0,1],
            [1,1,1]
        ],
        color: '#f0a000'
    }
};

// Game constants
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const BLOCK_SIZE = 30;