// src/InitGame.js
import { Stack, Button, FormControl, InputLabel, Select, MenuItem, TextField } from "@mui/material";
import { useState } from "react";
import CustomDialog from "./components/CustomDialog";
import socket from "./socket";

export default function InitGame({ setRoom, setOrientation, setPlayers, setGameType, setBoardSize }) {
  const [selectedBoardSize,setSelectedBoardSize]=useState("8x8");
  const [roomDialogOpen,setRoomDialogOpen]=useState(false);
  const [roomInput,setRoomInput]=useState("");
  const [roomError,setRoomError]=useState("");
  const [selectedType,setSelectedType]=useState("alap");

  return (
    <Stack justifyContent="center" alignItems="center" sx={{py:1,height:"100vh"}}>
      <FormControl sx={{minWidth:240,mb:2}}>
        <InputLabel>Game type</InputLabel>
        <Select value={selectedType} onChange={(e)=>setSelectedType(e.target.value)}>
          <MenuItem value="alap">Default chess</MenuItem>
          <MenuItem value="paraszthaboru">Classic pawn war</MenuItem>
          
        </Select>
      </FormControl>

      <FormControl sx={{minWidth:180,mb:2}}>
        <InputLabel>Board size</InputLabel>
        <Select value={selectedBoardSize} onChange={(e)=>setSelectedBoardSize(e.target.value)}>
          <MenuItem value="8x8">8x8</MenuItem>
        </Select>
      </FormControl>

      <Button variant="contained" onClick={()=>{
        socket.emit("createRoom",(r)=>{
          setRoom(r);
          setOrientation("white");
          setGameType(selectedType);
          setBoardSize(selectedBoardSize);
        })
      }} sx={{mb:1}}>Start a game</Button>

      <Button onClick={()=>setRoomDialogOpen(true)}>Join a game</Button>

      <CustomDialog open={roomDialogOpen} handleContinue={()=>{
        if(!roomInput) return;
        socket.emit("joinRoom",{roomId:roomInput},(r)=>{
          if(r.error) return setRoomError(r.message);
          setRoom(r?.roomId);
          setPlayers(r?.players);
          setOrientation("black");
          setGameType(selectedType);
          setBoardSize(selectedBoardSize);
          setRoomDialogOpen(false);
        });
      }} title="Join Room" contentText="Enter a valid room ID">
        <TextField autoFocus margin="dense" label="Room ID" value={roomInput} onChange={(e)=>setRoomInput(e.target.value)} fullWidth variant="standard" error={Boolean(roomError)} helperText={roomError?`Invalid room ID: ${roomError}`:"Enter a room ID"} />
      </CustomDialog>
    </Stack>
  )
}
