import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface FruitItem {
  id: string;
  emoji: string;
  type: 'fruit' | 'bomb' | 'star';
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  points: number;
}

interface GameState {
  score: number;
  lives: number;
  isPlaying: boolean;
  gameOver: boolean;
  level: number;
}

const FRUITS = ['🍎', '🍌', '🍇', '🍉', '🍓', '🥝', '🍑', '🍒', '🥭', '🍍'];
const GAME_WIDTH = typeof window !== 'undefined' ? window.innerWidth : 1200;
const GAME_HEIGHT = typeof window !== 'undefined' ? window.innerHeight : 800;

export const NinjaFruitGame = () => {
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    lives: 3,
    isPlaying: false,
    gameOver: false,
    level: 1,
  });
  
  const [fruits, setFruits] = useState<FruitItem[]>([]);
  const [effects, setEffects] = useState<any[]>([]);
  const gameLoopRef = useRef<number>();
  const spawnTimerRef = useRef<NodeJS.Timeout>();

  // Sound effects using Web Audio API
  const playSound = useCallback((frequency: number, duration: number = 0.1, type: 'cut' | 'bomb' | 'bonus' | 'miss' = 'cut') => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    switch (type) {
      case 'cut':
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * 2, audioContext.currentTime + duration);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        break;
      case 'bomb':
        oscillator.frequency.setValueAtTime(100, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + duration);
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        break;
      case 'bonus':
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + duration);
        gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
        break;
      case 'miss':
        oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + duration);
        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        break;
    }
    
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  }, []);

  // Create cut effect with particles
  const createCutEffect = useCallback((x: number, y: number, color: string) => {
    const particleCount = 8;
    const newEffects = [];
    
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = 50 + Math.random() * 50;
      newEffects.push({
        id: Math.random().toString(),
        x,
        y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        color,
        life: 1,
      });
    }
    
    setEffects(prev => [...prev, ...newEffects]);
    
    // Remove effects after animation
    setTimeout(() => {
      setEffects(prev => prev.filter(effect => !newEffects.some(e => e.id === effect.id)));
    }, 800);
  }, []);

  // Create score popup
  const createScorePopup = useCallback((x: number, y: number, points: number) => {
    const popup = document.createElement('div');
    popup.className = 'score-popup';
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
    popup.style.color = points > 0 ? 'hsl(var(--bonus))' : 'hsl(var(--destructive))';
    popup.textContent = points > 0 ? `+${points}` : '-1 Life';
    
    document.body.appendChild(popup);
    
    setTimeout(() => {
      document.body.removeChild(popup);
    }, 1000);
  }, []);

  // Spawn fruit
  const spawnFruit = useCallback(() => {
    const side = Math.random();
    let x, vx;
    
    if (side < 0.5) {
      // Spawn from left
      x = -60;
      vx = 2 + Math.random() * 4;
    } else {
      // Spawn from right
      x = GAME_WIDTH + 60;
      vx = -(2 + Math.random() * 4);
    }
    
    const fruitType = Math.random();
    let emoji, type: FruitItem['type'], points;
    
    if (fruitType < 0.7) {
      // Regular fruit
      emoji = FRUITS[Math.floor(Math.random() * FRUITS.length)];
      type = 'fruit';
      points = 10;
    } else if (fruitType < 0.85) {
      // Bomb
      emoji = '💣';
      type = 'bomb';
      points = -1; // Represents life loss
    } else {
      // Star bonus
      emoji = '⭐';
      type = 'star';
      points = 50;
    }
    
    const newFruit: FruitItem = {
      id: Math.random().toString(),
      emoji,
      type,
      x,
      y: GAME_HEIGHT - 100,
      vx,
      vy: -(8 + Math.random() * 6), // Upward velocity
      rotation: 0,
      rotationSpeed: (Math.random() - 0.5) * 10,
      points,
    };
    
    setFruits(prev => [...prev, newFruit]);
  }, []);

  // Handle fruit click
  const handleFruitClick = useCallback((fruit: FruitItem) => {
    if (!gameState.isPlaying) return;
    
    setFruits(prev => prev.filter(f => f.id !== fruit.id));
    
    if (fruit.type === 'bomb') {
      // Bomb hit - lose life
      playSound(100, 0.3, 'bomb');
      createCutEffect(fruit.x + 30, fruit.y + 30, 'hsl(var(--destructive))');
      createScorePopup(fruit.x + 30, fruit.y + 30, fruit.points);
      
      setGameState(prev => {
        const newLives = prev.lives - 1;
        return {
          ...prev,
          lives: newLives,
          gameOver: newLives <= 0,
          isPlaying: newLives > 0,
        };
      });
    } else {
      // Fruit or star hit
      const soundFreq = fruit.type === 'star' ? 800 : 400 + Math.random() * 400;
      playSound(soundFreq, 0.15, fruit.type === 'star' ? 'bonus' : 'cut');
      
      const color = fruit.type === 'star' ? 'hsl(var(--bonus))' : 'hsl(var(--primary))';
      createCutEffect(fruit.x + 30, fruit.y + 30, color);
      createScorePopup(fruit.x + 30, fruit.y + 30, fruit.points);
      
      setGameState(prev => ({
        ...prev,
        score: prev.score + fruit.points,
      }));
    }
  }, [gameState.isPlaying, playSound, createCutEffect, createScorePopup]);

  // Game loop
  const gameLoop = useCallback(() => {
    if (!gameState.isPlaying) return;
    
    setFruits(prev => {
      const updatedFruits = prev
        .map(fruit => ({
          ...fruit,
          x: fruit.x + fruit.vx,
          y: fruit.y + fruit.vy,
          vy: fruit.vy + 0.5, // Gravity
          rotation: fruit.rotation + fruit.rotationSpeed,
        }))
        .filter(fruit => {
          // Remove fruits that fell off screen
          if (fruit.y > GAME_HEIGHT + 100) {
            if (fruit.type === 'fruit' || fruit.type === 'star') {
              // Lost fruit - lose life
              playSound(150, 0.2, 'miss');
              setGameState(current => {
                const newLives = current.lives - 1;
                return {
                  ...current,
                  lives: newLives,
                  gameOver: newLives <= 0,
                  isPlaying: newLives > 0,
                };
              });
            }
            return false;
          }
          return fruit.x > -100 && fruit.x < GAME_WIDTH + 100;
        });
      
      return updatedFruits;
    });
    
    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState.isPlaying, playSound]);

  // Start game
  const startGame = useCallback(() => {
    setGameState({
      score: 0,
      lives: 3,
      isPlaying: true,
      gameOver: false,
      level: 1,
    });
    setFruits([]);
    setEffects([]);
    
    // Start spawning fruits
    spawnTimerRef.current = setInterval(() => {
      spawnFruit();
    }, 1500);
    
    // Start game loop
    gameLoop();
  }, [spawnFruit, gameLoop]);

  // Stop game
  const stopGame = useCallback(() => {
    setGameState(prev => ({ ...prev, isPlaying: false }));
    if (spawnTimerRef.current) {
      clearInterval(spawnTimerRef.current);
    }
    if (gameLoopRef.current) {
      cancelAnimationFrame(gameLoopRef.current);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (spawnTimerRef.current) {
        clearInterval(spawnTimerRef.current);
      }
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Game UI */}
      <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-center">
        <Card className="game-ui px-6 py-3">
          <div className="flex items-center space-x-6">
            <div>
              <span className="text-sm text-muted-foreground">Score</span>
              <div className="text-2xl font-bold text-primary">{gameState.score}</div>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Lives</span>
              <div className="text-2xl font-bold text-accent">
                {'❤️'.repeat(gameState.lives)}
              </div>
            </div>
          </div>
        </Card>
        
        {!gameState.isPlaying && (
          <Card className="game-ui px-6 py-3">
            <Button 
              onClick={startGame}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {gameState.gameOver ? 'Play Again' : 'Start Game'}
            </Button>
          </Card>
        )}
      </div>

      {/* Game Over Screen */}
      {gameState.gameOver && (
        <div className="absolute inset-0 flex items-center justify-center z-30">
          <Card className="game-ui p-8 text-center max-w-md">
            <h2 className="text-3xl font-bold text-accent mb-4">Game Over!</h2>
            <p className="text-xl text-muted-foreground mb-2">Final Score</p>
            <p className="text-4xl font-bold text-primary mb-6">{gameState.score}</p>
            <Button 
              onClick={startGame}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Play Again
            </Button>
          </Card>
        </div>
      )}

      {/* Game Area */}
      <div className="relative w-full h-full">
        {/* Fruits */}
        {fruits.map(fruit => (
          <div
            key={fruit.id}
            className="fruit-item animate-bounce-in"
            style={{
              left: `${fruit.x}px`,
              top: `${fruit.y}px`,
              transform: `rotate(${fruit.rotation}deg)`,
              fontSize: '60px',
            }}
            onClick={() => handleFruitClick(fruit)}
          >
            {fruit.emoji}
          </div>
        ))}

        {/* Particle Effects */}
        {effects.map(effect => (
          <div
            key={effect.id}
            className="particle"
            style={{
              left: `${effect.x}px`,
              top: `${effect.y}px`,
              backgroundColor: effect.color,
              width: '8px',
              height: '8px',
              '--dx': `${effect.dx}px`,
              '--dy': `${effect.dy}px`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Instructions */}
      {!gameState.isPlaying && !gameState.gameOver && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
          <Card className="game-ui p-4 text-center">
            <p className="text-muted-foreground">
              Click fruits to slice them! Avoid bombs 💣 and grab stars ⭐ for bonus points!
            </p>
          </Card>
        </div>
      )}
    </div>
  );
};