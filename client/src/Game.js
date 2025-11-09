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
import PromotionDialog from "./components/PromotionDialog";

// function boardToPosition(board) {
//   const position = {};
//   board.forEach((row, x) =>
//     row.forEach((piece, y) => {
//       if (piece) position[coordToSquare(x, y,rows)] = piece;
//     })
//   );
//   return position;
// }

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


  // --- Promóció állapot Micro Chess-hez ---
const [promotionData, setPromotionData] = useState(null);

const handlePromotionSelect = (promoteTo) => {
  if (!promotionData) return;
  const { fromX, fromY, toX, toY, captured } = promotionData;

  const piece = board[fromX][fromY];

  // 🔄 Másolat a tábláról, hogy közvetlenül módosíthassunk rajta
  const newBoard = board.map((row) => [...row]);

  // 🧹 Ha ütött bábu van a célmezőn, távolítsd el (biztonsági okból)
  if (captured) {
    newBoard[toX][toY] = null;
  }

  // ♕ Végrehajtjuk a promóciót
  const promotedBoard = makeMove(
    newBoard,
    fromX,
    fromY,
    toX,
    toY,
    promoteTo,
    enPassantTarget,
    gameType
  );

  const newEnPassant = null;
  const nextWTurn = !(turnColor === "white");

  const newHistoryEntry = {
    board: promotedBoard,
    wTurn: nextWTurn,
    enPassantTarget: newEnPassant,
  };
  const newHistory = [...history, newHistoryEntry];

  setBoard(promotedBoard);
  setHistory(newHistory);
  setPromotionData(null);
  setEnPassantTarget(newEnPassant);
  hasMovedRef.current = true;

  // 🔄 Ellenőrzés: játék vége-e
  const status = getGameStatus(
    promotedBoard,
    nextWTurn,
    newHistory,
    newEnPassant,
    gameType
  );

  // 🔊 Küldjük a lépést a szerverre
  socket.emit("move", {
    room,
    board: promotedBoard,
    move: { piece, fromRow: fromX, fromCol: fromY, toRow: toX, toCol: toY, promoteTo },
    playerId: playerId.current,
    enPassantTarget: newEnPassant,
    turnColor: nextWTurn ? "white" : "black",
    history: newHistory,
  });

  // 🧠 Ha vége a játéknak
  if (status.status !== "playing") {
    openModalForStatus(status);
    socket.emit("drawOrMate", { room, status });
  } else {
    setTurnColor(nextWTurn ? "white" : "black");
  }
};



 


  const hasMovedRef = useRef(false);
  const playerId = useRef(socket.id);


// 🔄 Orientáció a játékos színe alapján
const [localOrientation, setLocalOrientation] = useState("white");

useEffect(() => {
  const allPlayers = playersState.length ? playersState : players;
  const me = allPlayers.find((p) => p.id === socket.id);
  if (me && me.color) {
    setLocalOrientation(me.color);
  }
}, [playersState, players]);


// 🔄 Ha a külső orientation változik, frissítsd a helyi nézetet is
useEffect(() => {
  if (orientation) {
    setLocalOrientation(orientation);
  }
}, [orientation]);




  const rows = parseInt(boardSize?.split("x")[1] || 8);
  const cols = parseInt(boardSize?.split("x")[0] || 8);

  
  // ✅ IDE MOZGASD BE
  const boardToPosition = useCallback(
    (board) => {
      const position = {};
      board.forEach((row, x) =>
        row.forEach((piece, y) => {
          if (piece) position[coordToSquare(x, y, rows)] = piece;
        })
      );
      return position;
    },
    [rows]
  );


  // ----------- MODÁL MEGJELENÍTÉS ----------- //
  const openModalForStatus = (status) => {
  let title = "", text = "";


  // --- Parasztháború logika ---
  if (gameType === "paraszthaboru") {
    const reason = status?.reason;
    if (status.status === "finished") {
      title = "Game over!";
      if (reason === "no-move") {
        // egyik félnek csak 1 gyalogja maradt és/vagy nem tud legálisan lépni
        text =
          status.winner === "White"
            ? "White wins — Black cannot move."
            : "Black wins — White cannot move.";
      } else {
        // normál beérés/elfogyás esetek
        text = status.winner === "White" ? "White wins!" : "Black wins!";
      }
    } else if (status.status === "stalemate") {
      title = "Game over!";
      text = "Draw - egyik fél sem tud szabályos lépést tenni.";
    }
  }

    // --- Vezérharc logika ---
    else if (gameType === "vezerharc") {
      if (status.status === "finished") {
        title = "Game over!";
        if (status.reason === "queen_captured") {
          text = "Black wins — the Queen has been captured!";
        } else if (status.reason === "all_pawns_captured") {
          text = "White wins — all pawns have been taken!";
        } else if (status.reason === "pawn_promoted") {
          text = "Black wins — a pawn reached promotion!";
        } else {
          text = status.winner === "Black" ? "Black wins!" : "White wins!";
        }
      } else {
        title = "Game in progress";
        text = "Keep fighting!";
      }
    }


    // --- Bástyaharc logika ---
else if (gameType === "bastyaharc") {
  if (status.status === "finished") {
    title = "Game over!";
    if (status.reason === "rook_captured") {
      text = "Black wins — the Rook has been captured!";
    } else if (status.reason === "safe_pawn_promoted") {
      text = "Black wins — a pawn reached the promotion!";
    } else if (status.reason === "all_pawns_captured") {
      text = "White wins — all pawns have been taken!";
    } else {
      text = status.winner === "Black" ? "Black wins!" : "White wins!";
    }
  } else {
    title = "Game in progress";
    text = "Keep fighting!";
  }
}

// --- Futóharc logika ---
else if (gameType === "futoharc") {
  if (status.status === "finished") {
    title = "Game over!";
    if (status.reason === "bishop_captured") {
      text = "Black wins — the Bishop has been captured!";
    } else if (status.reason === "safe_pawn_promoted") {
      text = "Black wins — a pawn reached the promotion!";
    } else if (status.reason === "all_pawns_captured") {
      text = "White wins — all pawns have been taken!";
    } else {
      text = status.winner === "Black" ? "Black wins!" : "White wins!";
    }
  } else {
    title = "Game in progress";
    text = "Keep fighting!";
  }
}


// --- Huszárok vs gyalogok logika ---
else if (gameType === "huszarok_vs_gyalogok") {
  if (status.status === "finished") {
    title = "Game over!";
    if (status.reason === "knights_captured") {
      text = "White wins — both Knights have been captured!";
    } else if (status.reason === "safe_pawn_promoted") {
      text = "White wins — a pawn reached the promotion!";
    } else if (status.reason === "all_pawns_captured") {
      text = "Black wins — all pawns have been taken!";
    } else {
      text = status.winner === "White" ? "White wins!" : "Black wins!";
    }
  } else {
    title = "Game in progress";
    text = "Keep fighting!";
  }
}


// --- Vezér vs Huszár logika ---
else if (gameType === "queen_vs_knight") {
  if (status.status === "finished") {
    title = "Game over!";
     // 🟢 Itt cseréljük meg a győztes szöveget
    if (status.reason === "queen_captured") {
      text = "White wins — the Queen has been captured!"; // vezér = fekete, tehát fehér nyer
    } else if (status.reason === "knight_captured") {
      text = "Black wins — the Knight has been captured!"; // huszár = fehér, tehát fekete nyer
    } else {
      text = status.winner === "White" ? "White wins!" : "Black wins!";
    }
  } else {
    title = "Game in progress";
    text = "Try to outmaneuver your opponent!";
  }
}

// --- Világos vs Sötét király logika ---
else if (gameType === "kiralyvadaszat") {
  if (status.status === "finished") {
    title = "Game over!";
  
    if (status.reason === "checkmate") {
     title = "Checkmate!";
    text = "White wins by checkmate.";
  
   } else if (status.reason === "stalemate") {
     text = "Draw — the Black King achieved stalemate!";
   } else {
     text = status.winner === "White" ? "White wins!" : "Draw!";
   }
  } else {
    title = "King Hunt in progress";
    text = "Checkmate or stalemate — the hunt continues!";
  }
}


// --- ACTIVE CHESS logika ---
else if (gameType === "active_chess") {
  if (status.status === "checkmate") {
    title = "Dynamic Checkmate!";
    text = `${status.winner} wins in Active Chess — expanded board victory!`;
  } else if (status.status === "stalemate") {
    title = "Dynamic Stalemate!";
    text = "No legal moves left — the expanded board ends in a draw.";
  } else if (status.status === "insufficient") {
    title = "Draw!";
    text = "Insufficient material for checkmate in Active Chess.";
  } else if (status.status === "threefold") {
    title = "Draw by Repetition!";
    text = "Same position repeated three times — it’s a draw.";
  }
}




    // --- Alap sakk logika ---
    else {
      switch (status.status) {
         case "finished":
    if (status.reason === "checkmate") {
      title = "Checkmate!";
      text = `${status.winner} wins by checkmate.`;
      break;
    }
    // ha más okkal finished, essen vissza az általános logikára
     // (pl. már kezeltük fent a speciális játékmódokban)
     break;
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

  // ----------- LÉPÉS VÉGREHAJTÁSA ----------- //
  const executeMove = (fromX, fromY, toX, toY) => {
    const piece = board[fromX][fromY];
    if (!piece) return;

    const promoteTo = null;
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

  // ----------- KLIENS OLDALI MOZGÁSKEZELÉS ----------- //
  const handleMove = useCallback(
    (from, to) => {
      if (playersState.length < 2 || hasMovedRef.current) return;
      let [fromX, fromY] = squareToCoord(from,rows);
      let [toX, toY] = squareToCoord(to,rows);


    //     // 🔄 Ha a játékos fekete, tükrözzük a koordinátákat
    // if (orientation === "black") {
    //   fromX = rows - 1 - fromX;
    //   toX = rows - 1 - toX;
    //   fromY = cols - 1 - fromY;
    //   toY = cols - 1 - toY;
    // }

      const piece = board[fromX][fromY];
      if (!piece) return;

      const wTurn = isWhite(piece);
      if ((turnColor === "white" && !wTurn) || (turnColor === "black" && wTurn)) return;

      const validMoves = getValidMoves(board, fromX, fromY, enPassantTarget, gameType);
      if (!validMoves.some(([x, y]) => x === toX && y === toY)) return;


   // --- Micro Chess: promóció popup (ütésre is) ---
if (gameType === "micro_chess" && piece && piece.toLowerCase() === "p") {
  const isWhitePawn = piece === "P";
  const promotionRank = isWhitePawn ? 0 : rows - 1;

  // ⚡ NEM érdekel, hogy üt vagy simán lép — ha beér a sorba, promóció jön
  if (toX === promotionRank) {
    setPromotionData({
      fromX,
      fromY,
      toX,
      toY,
      color: isWhitePawn ? "white" : "black",
    });
    return; // várjuk a választást
  }
}



      executeMove(fromX, fromY, toX, toY);
    },
    [board, turnColor, playersState, enPassantTarget, history, gameType,rows]
  );

  // ----------- SOCKET ESEMÉNYEK ----------- //
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

    const handleThreefoldRepetition = () => openModalForStatus({ status: "threefold" });
    const handleFiftyMoveRule = () => openModalForStatus({ status: "fifty-move-rule" });
    const handleDrawOrMate = ({ status }) => {
      if (status && status.status !== "playing") openModalForStatus(status);
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

  // ----------- UI RENDER ----------- //
  // --- AUTOMATIKUS POPUP Active Chess esetén ---
useEffect(() => {
  if (gameType === "active_chess") {
    const status = getGameStatus(
      board,
      turnColor === "white",
      history,
      enPassantTarget,
      gameType
    );
    if (status && status.status && status.status !== "playing") {
      openModalForStatus(status);
    }
  }
}, [board, turnColor, history, enPassantTarget, gameType]);




  return (
    <Stack spacing={2} sx={{ pt: 2 }}>
      <Card>
        <CardContent>
          <Typography variant="h5">Room ID: {room}</Typography>
          <Typography variant="body2">Current turn: {turnColor}</Typography>
          <Typography variant="body2">
  Game type:{" "}
  {gameType === "paraszthaboru"
    ? "Classic pawn war"
    : gameType === "vezerharc"
    ? "Queen vs 8 Pawns"
    : gameType === "bastyaharc"
    ? "Rook vs 5 Pawns"
    : gameType === "futoharc"
    ? "Bishop vs 3 Pawns"
    : gameType === "huszarok_vs_gyalogok"
    ? "2 Knights vs 3 Pawns"
       : gameType === "queen_vs_knight"
    ? "Queen vs Knight"
     : gameType === "kiralyvadaszat"
    ? "King Hunt"
    :gameType==="active_chess"
    ? "Active Chess"
      :gameType==="faraway_chess"
    ? "Faraway Chess"
      :gameType==="micro_chess"
    ? "Micro Chess"
      : "Default chess"}
</Typography>

        </CardContent>
      </Card>

      <Stack flexDirection="row" spacing={2}>
        <CustomBoard
          position={boardToPosition(board)}
          onMove={handleMove}
          orientation={localOrientation}
   
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

{/* ♕ Promóció popup – csak Micro Chess esetén */}
{gameType === "micro_chess" && promotionData && (
  <PromotionDialog
    open={!!promotionData}
    color={promotionData.color}
    onSelect={handlePromotionSelect}
  />
)}




    </Stack>
  );
}
