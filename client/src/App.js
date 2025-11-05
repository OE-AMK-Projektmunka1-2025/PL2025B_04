import { useEffect, useState, useCallback } from "react";
import Container from "@mui/material/Container";
import Game from "./Game";
import InitGame from "./InitGame";
import CustomDialog from "./components/CustomDialog";
import socket from "./socket";
import { TextField, Box } from "@mui/material";

export default function App() {
  const [username, setUsername] = useState("");
  const [usernameSubmitted, setUsernameSubmitted] = useState(false);
  const [room, setRoom] = useState("");
  const [orientation, setOrientation] = useState("");
  const [players, setPlayers] = useState([]);
  const [gameType, setGameType] = useState("paraszthaboru");
  const [boardSize, setBoardSize] = useState("8x8");

  const cleanup = useCallback(() => {
    setRoom("");
    setOrientation("");
    setPlayers([]);
  }, []);

  useEffect(() => {
    socket.on("opponentJoined", (roomData) => {
      setPlayers(roomData.players);
    });
  }, []);

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <CustomDialog
        open={!usernameSubmitted}
        handleContinue={() => {
          if (!username.trim()) return;
          socket.emit("username", username);
          setUsernameSubmitted(true);
        }}
        title="Pick a username"
        contentText="Please select a username"
      >
        <TextField
          autoFocus
          margin="dense"
          label="Username"
          value={username}
          required
          onChange={(e) => setUsername(e.target.value)}
          fullWidth
          variant="standard"
        />
      </CustomDialog>

      <Box sx={{ mt: 4 }}>
        {usernameSubmitted && (
          <>
            {room ? (
              <Game
                room={room}
                orientation={orientation}
                username={username}
                players={players}
                gameType={gameType}
                boardSize={boardSize}
                cleanup={cleanup}
              />
            ) : (
              <InitGame
                setRoom={setRoom}
                setOrientation={setOrientation}
                setPlayers={setPlayers}
                setGameType={setGameType}
                setBoardSize={setBoardSize}
              />
            )}
          </>
        )}
      </Box>
    </Container>
  );
}
