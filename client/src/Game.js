// src/Game.js
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Stack,
  Card,
  CardContent,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListSubheader,
} from "@mui/material";
import socket from "./socket";
import CustomBoard from "./components/CustomBoard";
import CustomDialog from "./components/CustomDialog";
import {
  initialBoard,
  squareToCoord,
  coordToSquare,
  getValidMoves,
  makeMove,
  getGameStatus,
  isWhite,
} from "./components/ChessEngine";

function boardToPosition(board) {
  const position = {};
  board.forEach((row, x) =>
    row.forEach((piece, y) => {
      if (piece) position[coordToSquare(x, y)] = piece;
    })
  );
  return position;
}

export default function Game({
  players,
  room,
  orientation,
  cleanup,
  gameType,
  boardSize,
}) {
  const [playersState, setPlayersState] = useState(players || []);
  const [board, setBoard] = useState(() => initialBoard(gameType));
  const [history, setHistory] = useState(() => [
    { board: initialBoard(gameType), wTurn: true, enPassantTarget: null },
  ]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalText, setModalText] = useState("");
  const [turnColor, setTurnColor] = useState("white");
  const [enPassantTarget, setEnPassantTarget] = useState(null);

  const hasMovedRef = useRef(false);
  const playerId = useRef(socket.id);

  const rows = parseInt(boardSize?.split("x")[1] || 8);
  const cols = parseInt(boardSize?.split("x")[0] || 8);

  const openModalForStatus = (status) => {
    let title = "", text = "";

    // --- Parasztháború-specifikus állapotok ---
    if (gameType === "paraszthaboru") {
      if (status.status === "finished") {
        title = "Game over!";
        if (status.winner === "White") {
          text = "White wins!";
        } else if (status.winner === "Black") {
          text = "Black wins!";
        }
      } else if (status.status === "stalemate") {
        title = "Nincs több lépés";
        text = "Döntetlen - egyik fél sem tud szabályos lépést tenni.";
      }
    } else {
      // --- Eredeti sakk-logika ---
      switch (status.status) {
        case "checkmate":
          title = "Checkmate!";
          text = `${status.winner} wins!`;
          break;
        case "stalemate":
          title = "Stalemate";
          text = "Game ended in stalemate.";
          break;
        case "insufficient":
          title = "Draw";
          text = "Draw by insufficient material.";
          break;
        case "threefold":
          title = "Draw";
          text = "Draw by threefold repetition.";
          break;
        case "fifty-move-rule":
          title = "Draw";
          text = "Draw by fifty-move rule.";
          break;
        default:
          break;
      }
    }

    setModalTitle(title);
    setModalText(text);
    setModalOpen(true);
  };

  const executeMove = (fromX, fromY, toX, toY) => {
    const piece = board[fromX][fromY];
    if (!piece) return;

    const promoteTo =
      piece.toLowerCase() === "p" &&
      ((piece === "P" && toX === 0) || (piece === "p" && toX === 7))
        ? piece === "P"
          ? "Q"
          : "q"
        : null;

    const newBoard = makeMove(
      board,
      fromX,
      fromY,
      toX,
      toY,
      promoteTo,
      enPassantTarget,
      gameType
    );

    let newEnPassant = null;
    if (piece.toLowerCase() === "p" && Math.abs(fromX - toX) === 2) {
      newEnPassant = { row: (fromX + toX) / 2, col: fromY };
    }

    const nextWTurn = !(turnColor === "white");
    const newHistoryEntry = {
      board: newBoard,
      wTurn: nextWTurn,
      enPassantTarget: newEnPassant,
    };
    const newHistory = [...history, newHistoryEntry];

    setBoard(newBoard);
    setHistory(newHistory);
    setEnPassantTarget(newEnPassant);
    hasMovedRef.current = true;

    const status = getGameStatus(
      newBoard,
      nextWTurn,
      newHistory,
      newEnPassant,
      gameType
    );

    socket.emit("move", {
      room,
      board: newBoard,
      move: { piece, fromRow: fromX, fromCol: fromY, toRow: toX, toCol: toY },
      playerId: playerId.current,
      enPassantTarget: newEnPassant,
      turnColor: nextWTurn ? "white" : "black",
      history: newHistory,
    });

    if (status.status !== "playing") {
      openModalForStatus(status);
      socket.emit("drawOrMate", { room, status });
    } else {
      setTurnColor(nextWTurn ? "white" : "black");
    }
  };

  const handleMove = useCallback(
    (from, to) => {
      if (playersState.length < 2 || hasMovedRef.current) return;
      const [fromX, fromY] = squareToCoord(from);
      const [toX, toY] = squareToCoord(to);
      const piece = board[fromX][fromY];
      if (!piece) return;

      const wTurn = isWhite(piece);
      if ((turnColor === "white" && !wTurn) || (turnColor === "black" && wTurn)) return;

      const validMoves = getValidMoves(board, fromX, fromY, enPassantTarget, gameType);
      if (!validMoves.some(([x, y]) => x === toX && y === toY)) return;

      executeMove(fromX, fromY, toX, toY);
    },
    [board, turnColor, playersState, enPassantTarget, history, gameType]
  );

  useEffect(() => {
    const handleMoveSocket = ({
      board: newBoard,
      enPassantTarget: newEPTarget,
      turnColor: nextTurn,
    }) => {
      if (!newBoard) return;
      const nextWTurn = nextTurn === "white";

      const newHistoryEntry = {
        board: newBoard,
        wTurn: nextWTurn,
        enPassantTarget: newEPTarget || null,
      };
      const newHistory = [...history, newHistoryEntry];

      setBoard(newBoard);
      setHistory(newHistory);
      setTurnColor(nextWTurn ? "white" : "black");
      setEnPassantTarget(newEPTarget || null);
      hasMovedRef.current = false;

      const status = getGameStatus(
        newBoard,
        nextWTurn,
        newHistory,
        newEPTarget || null,
        gameType
      );
      if (status.status !== "playing") openModalForStatus(status);
    };

    const handleThreefoldRepetition = () => {
      openModalForStatus({ status: "threefold" });
    };

    const handleFiftyMoveRule = () => {
      openModalForStatus({ status: "fifty-move-rule" });
    };

    const handleDrawOrMate = ({ status }) => {
      if (status && status.status !== "playing") {
        openModalForStatus(status);
      }
    };

    const handleOpponentJoined = (roomData) => setPlayersState(roomData.players);

    const handleDisconnect = (player) => {
      setModalTitle("Player Disconnected");
      setModalText(`${player.username} has disconnected`);
      setModalOpen(true);
    };

    socket.on("move", handleMoveSocket);
    socket.on("drawOrMate", handleDrawOrMate);
    socket.on("threefoldRepetition", handleThreefoldRepetition);
    socket.on("fiftyMoveRule", handleFiftyMoveRule);
    socket.on("opponentJoined", handleOpponentJoined);
    socket.on("playerDisconnected", handleDisconnect);

    return () => {
      socket.off("move", handleMoveSocket);
      socket.off("drawOrMate", handleDrawOrMate);
      socket.off("threefoldRepetition", handleThreefoldRepetition);
      socket.off("fiftyMoveRule", handleFiftyMoveRule);
      socket.off("opponentJoined", handleOpponentJoined);
      socket.off("playerDisconnected", handleDisconnect);
    };
  }, [history, gameType]);

  return (
    <Stack spacing={2} sx={{ pt: 2 }}>
      <Card>
        <CardContent>
          <Typography variant="h5">Room ID: {room}</Typography>
          <Typography variant="body2">Current turn: {turnColor}</Typography>
          <Typography variant="body2">
            Game type: {gameType === "paraszthaboru" ? "Classic pawn war" : "Default chess"}
          </Typography>
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
          cleanup();
        }}
      />
    </Stack>
  );
}
