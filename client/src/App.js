import React, { useState, useEffect } from 'react';
import socket from './socket';
import './App.css';

// Helper function to calculate winner
const calculateWinner = (squares) => {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6] // diagonals
  ];

  for (const [a, b, c] of lines) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a];
    }
  }

  if (squares.every(square => square !== null)) {
    return 'draw';
  }

  return null;
};

// Helper function to get AI's move
const getAIMove = (board) => {
  // First, try to win
  const winningMove = findWinningMove(board, 'O');
  if (winningMove !== -1) return winningMove;

  // Second, block player's winning move
  const blockingMove = findWinningMove(board, 'X');
  if (blockingMove !== -1) return blockingMove;

  // Try to take center
  if (board[4] === null) return 4;

  // Try to take corners
  const corners = [0, 2, 6, 8];
  const availableCorners = corners.filter(i => board[i] === null);
  if (availableCorners.length > 0) {
    return availableCorners[Math.floor(Math.random() * availableCorners.length)];
  }

  // Take any available space
  const availableSpots = board.map((spot, i) => spot === null ? i : null).filter(spot => spot !== null);
  return availableSpots[Math.floor(Math.random() * availableSpots.length)];
};

// Helper function to find winning move
const findWinningMove = (board, player) => {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6] // diagonals
  ];

  for (const [a, b, c] of lines) {
    const squares = [board[a], board[b], board[c]];
    const playerSquares = squares.filter(square => square === player).length;
    const emptySquares = squares.filter(square => square === null).length;
    
    if (playerSquares === 2 && emptySquares === 1) {
      if (board[a] === null) return a;
      if (board[b] === null) return b;
      if (board[c] === null) return c;
    }
  }
  
  return -1;
};

function App() {
  const [roomId, setRoomId] = useState('');
  const [joinRoomId, setJoinRoomId] = useState('');
  const [gameMode, setGameMode] = useState('ai');
  const [gameState, setGameState] = useState({
    board: Array(9).fill(null),
    symbol: 'X',
    isMyTurn: true,
    gameStarted: false,
    winner: null
  });

  useEffect(() => {
    socket.on('roomCreated', ({ roomId, symbol }) => {
      setRoomId(roomId);
      setGameState(prev => ({
        ...prev,
        symbol,
        isMyTurn: symbol === 'X'
      }));
    });

    socket.on('joinedRoom', ({ symbol }) => {
      setGameState(prev => ({
        ...prev,
        symbol,
        isMyTurn: symbol === 'X'
      }));
    });

    socket.on('gameStart', ({ board }) => {
      setGameState(prev => ({
        ...prev,
        board,
        gameStarted: true
      }));
    });

    socket.on('updateGame', ({ board }) => {
      setGameState(prev => ({
        ...prev,
        board,
        isMyTurn: !prev.isMyTurn
      }));
    });

    socket.on('gameOver', ({ winner }) => {
      setGameState(prev => ({
        ...prev,
        winner,
        gameStarted: false
      }));
    });

    socket.on('playerLeft', () => {
      alert('Other player left the game');
      resetGame();
    });

    return () => {
      socket.off('roomCreated');
      socket.off('joinedRoom');
      socket.off('gameStart');
      socket.off('updateGame');
      socket.off('gameOver');
      socket.off('playerLeft');
    };
  }, []);

  const resetGame = () => {
    setGameState({
      board: Array(9).fill(null),
      symbol: gameMode === 'ai' ? 'X' : '',
      isMyTurn: true,
      gameStarted: gameMode === 'ai',
      winner: null
    });
    setRoomId('');
  };

  const createRoom = () => {
    socket.emit('createRoom');
  };

  const joinRoom = () => {
    socket.emit('joinRoom', joinRoomId);
    setRoomId(joinRoomId);
  };

  const handleClick = (index) => {
    if (gameState.winner || gameState.board[index] || (!gameState.gameStarted && gameMode !== 'ai') || !gameState.isMyTurn) {
      return;
    }

    if (gameMode === 'ai') {
      // Player's move
      const newBoard = [...gameState.board];
      newBoard[index] = 'X';
      
      // Check if player won
      const winner = calculateWinner(newBoard);
      if (winner) {
        setGameState(prev => ({
          ...prev,
          board: newBoard,
          winner,
          isMyTurn: false
        }));
        return;
      }

      // AI's move
      setGameState(prev => ({
        ...prev,
        board: newBoard,
        isMyTurn: false
      }));

      // Simulate AI thinking
      setTimeout(() => {
        const aiMove = getAIMove(newBoard);
        if (aiMove !== -1) {
          newBoard[aiMove] = 'O';
          const finalWinner = calculateWinner(newBoard);
          
          setGameState(prev => ({
            ...prev,
            board: newBoard,
            isMyTurn: true,
            winner: finalWinner
          }));
        }
      }, 500);
    } else {
      socket.emit('makeMove', {
        roomId,
        index,
        symbol: gameState.symbol
      });
    }
  };

  const handleModeChange = (mode) => {
    setGameMode(mode);
    setGameState({
      board: Array(9).fill(null),
      symbol: mode === 'ai' ? 'X' : '',
      isMyTurn: true,
      gameStarted: mode === 'ai',
      winner: null
    });
    setRoomId('');
  };

  const renderCell = (index) => {
    const value = gameState.board[index];
    return (
      <div
        key={index}
        className={`cell ${value ? value.toLowerCase() : ''}`}
        onClick={() => handleClick(index)}
      >
        {value}
      </div>
    );
  };

  return (
    <div className="App">
      <div className="game-container">
        <h1 className="game-title">Tic-Tac-Toe</h1>
        
        {!roomId && (
          <>
            <div className="mode-selection">
              <button 
                className={`mode-button ${gameMode === 'ai' ? 'active' : ''}`}
                onClick={() => handleModeChange('ai')}
              >
                Play vs AI
              </button>
              <button 
                className={`mode-button ${gameMode === 'friend' ? 'active' : ''}`}
                onClick={() => handleModeChange('friend')}
              >
                Play vs Friend
              </button>
            </div>

            {gameMode === 'friend' && (
              <div className="room-controls">
                <button onClick={createRoom}>Create Room</button>
                <div className="button-container">
                  <input
                    type="text"
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value)}
                    placeholder="Enter Room ID"
                  />
                  <button onClick={joinRoom}>Join Room</button>
                </div>
              </div>
            )}
          </>
        )}

        {roomId && (
          <div className="game-info">
            <p>Room ID: {roomId}</p>
            <p>You are: {gameState.symbol}</p>
            {gameState.gameStarted ? (
              <p>{gameState.isMyTurn ? 'Your turn' : "Opponent's turn"}</p>
            ) : (
              <p>Waiting for opponent...</p>
            )}
          </div>
        )}

        {(gameMode === 'ai' || gameState.gameStarted) && (
          <div className="board">
            {Array(9).fill(null).map((_, index) => renderCell(index))}
          </div>
        )}

        {gameState.winner && (
          <div className="winner">
            {gameState.winner === 'draw' 
              ? "It's a draw!" 
              : gameMode === 'ai'
                ? (gameState.winner === 'X' ? 'You won!' : 'AI won!')
                : (gameState.winner === gameState.symbol ? 'You won!' : 'Opponent won!')}
          </div>
        )}

        {(gameState.winner || (gameMode === 'ai' && gameState.board.some(cell => cell !== null))) && (
          <button onClick={resetGame}>Play Again</button>
        )}
      </div>
    </div>
  );
}

export default App;
