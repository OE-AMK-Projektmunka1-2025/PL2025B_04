// src/Game.js
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Stack, Card, CardContent, Typography, Box, List, ListItem, ListItemText, ListSubheader } from "@mui/material";
import socket from "./socket";
import CustomBoard from "./components/CustomBoard";
import CustomDialog from "./components/CustomDialog";
import { 
  initialBoard, squareToCoord, coordToSquare, getValidMoves, makeMove, getGameStatus, isWhite 
} from "./components/ChessEngine";

function boardToPosition(board){
  if(!board) return {};
  const position = {};
  for(let x=0;x<board.length;x++){
    for(let y=0;y<board[x].length;y++){
      const piece = board[x][y];
      if(piece) position[coordToSquare(x,y)] = piece;
    }
  }
  return position;
}

export default function Game({ players, room, orientation, cleanup, gameType, boardSize }) {
  const [playersState, setPlayersState] = useState(players || []);
  const [board, setBoard] = useState(() => initialBoard(gameType));
  const [history, setHistory] = useState([board]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalText, setModalText] = useState("");
  const [turnColor, setTurnColor] = useState("white");

  // Ref a körön belüli lépéshez
  const hasMovedRef = useRef(false);

  const rows = parseInt(boardSize?.split("x")[1] || 8);
  const cols = parseInt(boardSize?.split("x")[0] || 8);

  const executeMove = (fromX, fromY, toX, toY, piece) => {
    // Gyalog automatikus promóció
    let promoteTo = null;
    if(piece.toLowerCase() === "p"){
      if((piece === "P" && toX === 0) || (piece === "p" && toX === 7)){
        promoteTo = piece === "P" ? "Q" : "q";
      }
    }

    const newBoard = makeMove(board, fromX, fromY, toX, toY, promoteTo);
    const newHistory = [...history, newBoard];
    setBoard(newBoard);
    setHistory(newHistory);
    hasMovedRef.current = true;

    // Socketen továbbítás
    socket.emit("move", { board: newBoard, room });

    // Játékállapot ellenőrzés
    const status = getGameStatus(newBoard, !isWhite(piece), newHistory);
    if(status.status !== "playing"){
      let title="", text="";
      switch(status.status){
        case "checkmate": title="Checkmate!"; text=`${status.winner} wins!`; break;
        case "stalemate": title="Stalemate"; text="Game ended in stalemate."; break;
        case "insufficient": title="Draw"; text="Draw by insufficient material."; break;
        case "threefold": title="Draw"; text="Draw by threefold repetition."; break;
        default: break;
      }
      setModalTitle(title);
      setModalText(text);
      setModalOpen(true);
    }
  };

  const handleMove = useCallback((from, to) => {
    // Csak ha mindkét játékos csatlakozott
    if(playersState.length < 2) return;

    // Csak a soron lévő játékos léphet
    if(hasMovedRef.current) return;

    const [fromX, fromY] = squareToCoord(from);
    const [toX, toY] = squareToCoord(to);
    const piece = board[fromX][fromY];
    if(!piece) return;

    const wTurn = isWhite(piece);
    if((turnColor === "white" && !wTurn) || (turnColor === "black" && wTurn)) return;

    const validMoves = getValidMoves(board, fromX, fromY);
    if(!validMoves.some(([x,y]) => x === toX && y === toY)) return;

    executeMove(fromX, fromY, toX, toY, piece);
  }, [board, turnColor, playersState]);

  // Socket: ellenfél lépése
  useEffect(() => {
    const handleMoveSocket = ({ board: newBoard }) => {
      if(!newBoard) return;

      const newHistory = [...history, newBoard];
      setBoard(newBoard);
      setHistory(newHistory);
      setTurnColor(prev => prev === "white" ? "black" : "white");
      hasMovedRef.current = false;

      // Ellenőrizzük a játék végét
      const wTurn = !isWhite(newBoard.flat().find(p => p));
      const status = getGameStatus(newBoard, wTurn, newHistory);
      if(status.status !== "playing"){
        let title="", text="";
        switch(status.status){
          case "checkmate": title="Checkmate!"; text=`${status.winner} wins!`; break;
          case "stalemate": title="Stalemate"; text="Game ended in stalemate."; break;
          case "insufficient": title="Draw"; text="Draw by insufficient material."; break;
          case "threefold": title="Draw"; text="Draw by threefold repetition."; break;
          default: break;
        }
        setModalTitle(title);
        setModalText(text);
        setModalOpen(true);
      }
    };
    socket.on("move", handleMoveSocket);
    return () => socket.off("move", handleMoveSocket);
  }, [history]);

  // Socket: új játékos csatlakozott
  useEffect(() => {
    const handleOpponentJoined = roomData => setPlayersState(roomData.players);
    socket.on("opponentJoined", handleOpponentJoined);
    return () => socket.off("opponentJoined", handleOpponentJoined);
  }, []);

  // Socket: játékos kilépett
  useEffect(() => {
    const handleDisconnect = (player) => {
      setModalTitle("Player Disconnected");
      setModalText(`${player.username} has disconnected`);
      setModalOpen(true);
    };
    socket.on("playerDisconnected", handleDisconnect);
    return () => socket.off("playerDisconnected", handleDisconnect);
  }, []);

  return (
    <Stack spacing={2} sx={{ pt:2 }}>
      <Card>
        <CardContent>
          <Typography variant="h5">Room ID: {room}</Typography>
          <Typography variant="body2">Current turn: {turnColor}</Typography>
        </CardContent>
      </Card>

      <Stack flexDirection="row" spacing={2}>
        <CustomBoard
          position={boardToPosition(board)}
          onMove={handleMove}
          orientation={orientation}
          rows={rows}
          cols={cols}
        />

        <Box>
          <List>
            <ListSubheader>Players</ListSubheader>
            {playersState.map(p => (
              <ListItem key={p.id}><ListItemText primary={p.username} /></ListItem>
            ))}
          </List>
        </Box>
      </Stack>

      <CustomDialog
        open={modalOpen}
        title={modalTitle}
        contentText={modalText}
        handleContinue={() => { setModalOpen(false); cleanup(); }}
      />
    </Stack>
  );
}
