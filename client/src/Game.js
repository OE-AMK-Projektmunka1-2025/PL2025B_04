import React, { useState, useEffect, useCallback, useRef } from "react";
import { Stack, Card, CardContent, Typography, Box, List, ListItem, ListItemText, ListSubheader } from "@mui/material";
import socket from "./socket";
import CustomBoard from "./components/CustomBoard";
import CustomDialog from "./components/CustomDialog";
import { 
  initialBoard, squareToCoord, coordToSquare, getValidMoves, makeMove, 
  getGameStatus, isWhite 
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
  const [enPassantTarget, setEnPassantTarget] = useState(null);

  const hasMovedRef = useRef(false);
  const playerId = useRef(socket.id);

  const rows = parseInt(boardSize?.split("x")[1] || 8);
  const cols = parseInt(boardSize?.split("x")[0] || 8);

  const executeMove = (fromX, fromY, toX, toY, piece) => {
    let promoteTo = null;
    if(piece.toLowerCase() === "p"){
      if((piece === "P" && toX === 0) || (piece === "p" && toX === 7)){
        promoteTo = piece === "P" ? "Q" : "q";
      }
    }

    // --- En passant logika ---
    let capturedEnPassant = false;
    if (piece.toLowerCase() === "p" && enPassantTarget) {
      if (toX === enPassantTarget.row && toY === enPassantTarget.col) {
        const dir = piece === "P" ? 1 : -1;
        board[toX + dir][toY] = null; // leütjük az átlósan "átugrott" gyalogot
        capturedEnPassant = true;
      }
    }

    const newBoard = makeMove(board, fromX, fromY, toX, toY, promoteTo, enPassantTarget);
    const newHistory = [...history, newBoard];

    // Új en passant célmező, ha gyalog két mezőt lépett
    let newEnPassantTarget = null;
    if (piece.toLowerCase() === "p" && Math.abs(fromX - toX) === 2) {
      newEnPassantTarget = { row: (fromX + toX) / 2, col: fromY };
    }

    setBoard(newBoard);
    setHistory(newHistory);
    setEnPassantTarget(newEnPassantTarget);
    hasMovedRef.current = true;

    // Socketen küldjük a lépést
    socket.emit("move", {
      room,
      board: newBoard,
      move: { piece, fromRow: fromX, fromCol: fromY, toRow: toX, toCol: toY },
      playerId: playerId.current,
      enPassantTarget: newEnPassantTarget
    });

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
    if(playersState.length < 2) return;

    if(hasMovedRef.current) return; // ne lehessen többször lépni

    const [fromX, fromY] = squareToCoord(from);
    const [toX, toY] = squareToCoord(to);
    const piece = board[fromX][fromY];
    if(!piece) return;

    const wTurn = isWhite(piece);
    if((turnColor === "white" && !wTurn) || (turnColor === "black" && wTurn)) return;

    const validMoves = getValidMoves(board, fromX, fromY, enPassantTarget);
    if(!validMoves.some(([x,y]) => x === toX && y === toY)) return;

    executeMove(fromX, fromY, toX, toY, piece);
  }, [board, turnColor, playersState, enPassantTarget]);

  // 🔁 Socket: másik játékos lépett
  useEffect(() => {
    const handleMoveSocket = ({ board: newBoard, enPassantTarget: newEPTarget, turnColor: nextTurn }) => {
      if(!newBoard) return;

      setBoard(newBoard);
      setHistory(prev => [...prev, newBoard]);
      setTurnColor(nextTurn);
      setEnPassantTarget(newEPTarget);
      hasMovedRef.current = false;

      const wTurn = nextTurn === "white";
      const status = getGameStatus(newBoard, wTurn, history);
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

  // Ellenfél csatlakozott
  useEffect(() => {
    const handleOpponentJoined = roomData => setPlayersState(roomData.players);
    socket.on("opponentJoined", handleOpponentJoined);
    return () => socket.off("opponentJoined", handleOpponentJoined);
  }, []);

  // Játékos kilépett
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
