// Initialize and start the Tetris game
document.addEventListener('DOMContentLoaded', () => {
    const game = new Tetris();
    
    // Make game accessible globally for debugging
    window.tetrisGame = game;
    
    console.log('Tetris game initialized!');
    console.log('Controls:');
    console.log('← → Move pieces');
    console.log('↑ Rotate');
    console.log('↓ Soft drop');
    console.log('Space Hard drop');
    console.log('C Hold piece');
    console.log('P Pause/Resume');
    console.log('R Restart');
});