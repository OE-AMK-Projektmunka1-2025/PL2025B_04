import { Button, Stack, TextField, MenuItem, Select, InputLabel, FormControl } from "@mui/material";
import { useState } from "react";
import CustomDialog from "./components/CustomDialog";
import socket from "./socket";

export default function InitGame({ setRoom, setOrientation, setPlayers, setGameType, setBoardSize }) {
  // 💡 board size állapot (cols x rows)
  const [selectedBoardSize, setSelectedBoardSize] = useState("8x8"); // alapértelmezett
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [roomInput, setRoomInput] = useState("");
  const [roomError, setRoomError] = useState("");
  const [selectedType, setSelectedType] = useState("alap"); // alapértelmezett

  return (
    <Stack justifyContent="center" alignItems="center" sx={{ py: 1, height: "100vh" }}>
      {/* Játéktípus kiválasztás */}
      <FormControl sx={{ minWidth: 240, mb: 2 }}>
        <InputLabel id="game-type-label">Játéktípus</InputLabel>
        <Select
          labelId="game-type-label"
          value={selectedType}
          label="Játéktípus"
          onChange={(e) => setSelectedType(e.target.value)}
        >
          <MenuItem value="alap">Alap sakk (klasszikus)</MenuItem>
          <MenuItem value="paraszthaboru">Parasztháború</MenuItem>
          <MenuItem value="lovakcsata">Lovak csatája</MenuItem>
          <MenuItem value="knightmare">Knightmare</MenuItem>
          <MenuItem value="transcendental_chess">Transcendental chess</MenuItem>
          <MenuItem value="chess960">Chess960</MenuItem>
          <MenuItem value="mongredien_chess">Mongredien chess</MenuItem>
          <MenuItem value="fianchetto_chess">Fianchetto chess</MenuItem>
          <MenuItem value="vezér-huszár_chess">Vezér-huszár sakk</MenuItem>
        </Select>
      </FormControl>

      {/* Játékméret kiválasztás (cols x rows) */}
      <FormControl sx={{ minWidth: 180, mb: 2 }}>
        <InputLabel id="board-size-label">Játékméret</InputLabel>
        <Select
          labelId="board-size-label"
          value={selectedBoardSize}
          label="Játékméret"
          onChange={(e) => setSelectedBoardSize(e.target.value)}
        >
          <MenuItem value="8x8">8x8</MenuItem>
          <MenuItem value="8x9">8x9</MenuItem>
          <MenuItem value="8x10">8x10</MenuItem>
          <MenuItem value="8x11">8x11</MenuItem>
          <MenuItem value="8x12">8x12</MenuItem>
        </Select>
      </FormControl>

      {/* Start / Join gombok */}
      <Button
        variant="contained"
        onClick={() => {
          socket.emit("createRoom", (r) => {
            setRoom(r);
            setOrientation("white");
            setGameType(selectedType);
            setBoardSize(selectedBoardSize); // továbbadjuk cols x rows
          });
        }}
        sx={{ mb: 1 }}
      >
        Start a game
      </Button>

      <Button onClick={() => setRoomDialogOpen(true)}>Join a game</Button>

      {/* Room join dialog */}
      <CustomDialog
        open={roomDialogOpen}
        handleClose={() => setRoomDialogOpen(false)}
        title="Select Room to Join"
        contentText="Enter a valid room ID to join the room"
        handleContinue={() => {
          if (!roomInput) return;
          socket.emit("joinRoom", { roomId: roomInput }, (r) => {
            if (r.error) return setRoomError(r.message);
            setRoom(r?.roomId);
            setPlayers(r?.players);
            setOrientation("black");
            setGameType(selectedType);
            setBoardSize(selectedBoardSize); // továbbadjuk cols x rows
            setRoomDialogOpen(false);
          });
        }}
      >
        <TextField
          autoFocus
          margin="dense"
          id="room"
          label="Room ID"
          value={roomInput}
          onChange={(e) => setRoomInput(e.target.value)}
          fullWidth
          variant="standard"
          error={Boolean(roomError)}
          helperText={!roomError ? "Enter a room ID" : `Invalid room ID: ${roomError}`}
        />
      </CustomDialog>
    </Stack>
  );
}
