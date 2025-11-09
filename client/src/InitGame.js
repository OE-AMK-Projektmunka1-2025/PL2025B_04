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
          <MenuItem value="alap">Default Chess</MenuItem>
          <MenuItem value="paraszthaboru">Classic Pawn War</MenuItem>
           <MenuItem value="vezerharc">Queen vs 8 Pawns</MenuItem>
                 <MenuItem value="bastyaharc">Rook vs 5 Pawns</MenuItem>
                   <MenuItem value="futoharc">Bishop vs 3 Pawns</MenuItem>
            <MenuItem value="huszarok_vs_gyalogok">2 Knights vs 3 Pawns</MenuItem>
             <MenuItem value="queen_vs_knight">Queen vs Knight</MenuItem>
              <MenuItem value="kiralyvadaszat">King Hunt</MenuItem>
               <MenuItem value="active_chess">Active Chess</MenuItem>
                  <MenuItem value="faraway_chess">Faraway Chess</MenuItem>
                   <MenuItem value="micro_chess">Micro Chess</MenuItem>
               
               

        </Select>
      </FormControl>

      <FormControl sx={{minWidth:180,mb:2}}>
        <InputLabel>Board size</InputLabel>
        <Select value={selectedBoardSize} onChange={(e)=>setSelectedBoardSize(e.target.value)}>
          <MenuItem value="8x8">8x8</MenuItem>
          {selectedType==="active_chess" && (   <MenuItem value="9x8">9x8</MenuItem>)}
             {selectedType==="faraway_chess" && (   <MenuItem value="8x9">8x9</MenuItem>)}
       {selectedType==="micro_chess" && (   <MenuItem value="4x5">4x5</MenuItem>)}
        </Select>
      </FormControl>

      <Button variant="contained" onClick={()=>{

          if (selectedType === "active_chess" && selectedBoardSize !== "9x8") {
      alert("⚠️ Active Chess only supports 9x8 board size!");
      return;
    }

       if (selectedType === "faraway_chess" && selectedBoardSize !== "8x9") {
      alert("⚠️ Faraway Chess only supports 8x9 board size!");
      return;
    }


      if (selectedType === "micro_chess" && selectedBoardSize !== "4x5") {
      alert("⚠️ Micro Chess only supports 4x5 board size!");
      return;
    }
       

socket.emit("createRoom",(roomData)=>{
  if (!roomData) return;
  setRoom(roomData.roomId);
  setPlayers(roomData.players);
  // az első játékos mindig fehér, de a szerver küldött színe alapján állítjuk
  const me = roomData.players.find(p => p.id === socket.id);
  setOrientation(me?.color || "white");
  setGameType(selectedType);
  setBoardSize(selectedBoardSize);
});


      }} sx={{mb:1}}>Start a game</Button>

      <Button onClick={()=>setRoomDialogOpen(true)}>Join a game</Button>

      <CustomDialog open={roomDialogOpen} handleContinue={()=>{
        if(!roomInput) return;
        socket.emit("joinRoom",{roomId:roomInput},(r)=>{
          if(r.error) return setRoomError(r.message);
          setRoom(r?.roomId);
          setPlayers(r?.players);
          // setOrientation("black");

          // 🔄 Dinamikus orientáció: ha te vagy az első játékos → fehér, ha a második → fekete
const me = socket.id;
const amIWhite = r?.players?.[0]?.id === me;
setOrientation(amIWhite ? "white" : "black");

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
