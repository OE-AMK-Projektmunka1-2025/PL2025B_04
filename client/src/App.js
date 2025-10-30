import { useEffect, useState, useCallback } from "react";
import Container from "@mui/material/Container";
import Game from "./Game";
import InitGame from "./InitGame";
import CustomDialog from "./components/CustomDialog";
import socket from "./socket";
import { TextField } from "@mui/material";

export default function App() {
  const [username, setUsername] = useState("");
  const [usernameSubmitted, setUsernameSubmitted] = useState(false);

  const [room, setRoom] = useState("");
  const [orientation, setOrientation] = useState("");
  const [players, setPlayers] = useState([]);
    const [gameType, setGameType] = useState("paraszthaboru"); // 💡 új állapot
     const [boardSize, setBoardSize] = useState("8x8");

  // resets the states responsible for initializing a game
  const cleanup = useCallback(() => {
    setRoom("");
    setOrientation("");
    setPlayers([]);
  }, []);

  useEffect(() => {
    // const username = prompt("Username");
    // setUsername(username);
    // socket.emit("username", username);

    socket.on("opponentJoined", (roomData) => {
      console.log("roomData", roomData)
      setPlayers(roomData.players);
    });
  }, []);

  return (
    <Container>
      <CustomDialog
        open={!usernameSubmitted}
        handleClose={() => setUsernameSubmitted(true)}
        title="Pick a username"
        contentText="Please select a username"
        handleContinue={() => {
          if (!username) return;
          socket.emit("username", username);
          setUsernameSubmitted(true);
        }}
      >
        <TextField
          autoFocus
          margin="dense"
          id="username"
          label="Username"
          name="username"
          value={username}
          required
          onChange={(e) => setUsername(e.target.value)}
          type="text"
          fullWidth
          variant="standard"
        />
      </CustomDialog>
      {room ? (
        <Game
          room={room}
          orientation={orientation}
          username={username}
          players={players}
             gameType={gameType} 
          // the cleanup function will be used by Game to reset the state when a game is over
          boardSize={boardSize} // 💡 továbbadjuk a Game-nek
          cleanup={cleanup}
        />
      ) : (
        <InitGame
          setRoom={setRoom}
          setOrientation={setOrientation}
          setPlayers={setPlayers}
           setGameType={setGameType} 
             setBoardSize={setBoardSize} // 💡 továbbadjuk az InitGame-nek
        />
      )}
    </Container>
  );
}