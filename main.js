let game = null;

document.addEventListener('DOMContentLoaded', () => {
    const startOverlay = document.getElementById('startOverlay');
    const startBtn = document.getElementById('startBtn');

    startBtn.addEventListener('click', () => {
        startOverlay.style.display = 'none';
        game = new Tetris();
        window.tetrisGame = game;

        console.log('Tetris game started!');
        console.log('Controls:');
        console.log('← → Move pieces');
        console.log('↑ Rotate');
        console.log('↓ Soft drop');
        console.log('Space Hard drop');
        console.log('C Hold piece');
        console.log('P Pause/Resume');
        console.log('R Restart');
    });
});
