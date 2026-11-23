import { useMusic } from './audio/useMusic';
import { GameCanvas } from './game/GameCanvas';
import { useGameStore } from './state/gameStore';
import { CharacterCreation } from './ui/CharacterCreation';
import { DialogueBox } from './ui/DialogueBox';
import { Hud } from './ui/Hud';
import { MainMenu } from './ui/MainMenu';
import { BattleUi } from './ui/BattleUi';
import { PauseMenu } from './ui/PauseMenu';
import { ShopModal } from './ui/ShopModal';

export function App() {
  const screen = useGameStore((s) => s.screen);
  const session = useGameStore((s) => s.session);
  const sessionId = useGameStore((s) => s.sessionId);
  useMusic();

  if (screen === 'menu') return <MainMenu />;
  if (screen === 'create') return <CharacterCreation />;
  if (!session) return <MainMenu />;

  return (
    <div className="relative h-full w-full select-none">
      <GameCanvas key={sessionId} session={session} />
      <Hud />
      <BattleUi />
      <DialogueBox />
      <ShopModal />
      <PauseMenu />
    </div>
  );
}
