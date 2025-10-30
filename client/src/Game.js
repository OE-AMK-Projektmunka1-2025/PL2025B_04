import React, { useState, useRef, useEffect, useCallback } from "react";
import { Stack, Card, CardContent, Typography, Box, List, ListItem, ListItemText, ListSubheader } from "@mui/material";
import { Chess } from "chess.js";
import socket from "./socket";
import CustomBoard from "./components/CustomBoard";
import CustomDialog from "./components/CustomDialog";

function fenToPosition(fen) {
  const position = {};
  if (!fen) return position;
  const [rowsPart] = fen.split(" ");
  const ranks = rowsPart.split("/");
  for (let r = 0; r < ranks.length; r++) {
    let file = 0;
    for (const char of ranks[r]) {
      if (/[1-8]/.test(char)) {
        file += parseInt(char, 10);
      } else {
        const rank = 8 - r;
        const square = String.fromCharCode(97 + file) + rank;
        position[square] = char;
        file++;
      }
    }
  }
  return position;
}

export default function Game({ players, room, orientation, cleanup, gameType, boardSize }) {
  const [playersState, setPlayersState] = useState(players || []);
  const [fen, setFen] = useState(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalText, setModalText] = useState("");

  const chessRef = useRef(new Chess());
  const chess = chessRef.current;

  // inicializálás
  useEffect(() => {
    chess.reset();
    if (gameType === "paraszthaboru") {
      chess.load("4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1");
    }
    setFen(chess.fen());
  }, [gameType]);

  // lépés kezelése
  const makeAMove = useCallback(
    (moveData) => {
      try {
        const move = chess.move(moveData);
        if (!move) return null;
        setFen(chess.fen());

        // játék vége ellenőrzés
        if (chess.isCheckmate()) {
          const winner = chess.turn() === "w" ? "Black" : "White";
          setModalTitle("Checkmate!");
          setModalText(`${winner} wins!`);
          setModalOpen(true);
        } else if (chess.isStalemate()) {
          setModalTitle("Stalemate!");
          setModalText("It's a draw.");
          setModalOpen(true);
        } else if (chess.isInsufficientMaterial()) {
          setModalTitle("Draw");
          setModalText("Insufficient material.");
          setModalOpen(true);
        } else if (chess.isDraw()) {
          setModalTitle("Draw");
          setModalText("50-move rule or repetition.");
          setModalOpen(true);
        }

        return move;
      } catch (e) {
        console.error("Illegal move:", e);
        return null;
      }
    },
    [chess]
  );

  // CustomBoard onMove callback
  const handleMove = (from, to) => {
    if (chess.turn() !== orientation[0]) return;
    if (playersState.length < 2) return;
    const move = makeAMove({ from, to, promotion: "q" });
    if (move) {
      socket.emit("move", { move, room, fen: chess.fen() });
    }
  };

  // ellenfél lépése
  useEffect(() => {
    const handleMoveSocket = ({ move, fen }) => {
      try {
        if (fen && fen !== chess.fen()) {
          chess.load(fen);
          setFen(fen);
        }
      } catch (err) {
        console.error("Failed to load remote FEN:", err);
      }
    };
    socket.on("move", handleMoveSocket);
    return () => socket.off("move", handleMoveSocket);
  }, [chess]);

  // opponentJoined esemény kezelése
  useEffect(() => {
    const handleOpponentJoined = (roomData) => {
      setPlayersState(roomData.players);
    };
    socket.on("opponentJoined", handleOpponentJoined);
    return () => socket.off("opponentJoined", handleOpponentJoined);
  }, []);

  // disconnect kezelése
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
    <Stack spacing={2} sx={{ pt: 2 }}>
      <Card>
        <CardContent>
          <Typography variant="h5">Room ID: {room}</Typography>
        </CardContent>
      </Card>

      <Stack flexDirection="row" spacing={2}>
        <CustomBoard
  position={fenToPosition(fen)}
  onMove={handleMove}
  orientation={orientation}
/>

        <Box>
          <List>
            <ListSubheader>Players</ListSubheader>
            {playersState.map((p) => (
              <ListItem key={p.id}>
                <ListItemText primary={p.username} />
              </ListItem>
            ))}
          </List>
        </Box>
      </Stack>

      <CustomDialog
        open={modalOpen}
        title={modalTitle}
        contentText={modalText}
        handleContinue={() => {
          setModalOpen(false);
          cleanup(); // vissza az InitGame kezdőképernyőre
        }}
      />
    </Stack>
  );
}
