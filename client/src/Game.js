import {
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListSubheader,
  Stack,
  Typography,
  Box,
} from "@mui/material";
import { useState, useMemo, useCallback, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import CustomDialog from "./components/CustomDialog";
import socket from "./socket";

function Game({ players, room, orientation, cleanup, gameType }) {
  // ♟️ Alapállások különböző játéktípusokhoz
  const chess = useMemo(() => {
    const type = (gameType || "").toLowerCase().trim();

    if (type === "paraszthaboru")
      return new Chess("4k3/pppppppp/8/8/8/8/PPPPPPPP/4K3 w - - 0 1");
    if (type === "lovakcsata")
      return new Chess("4k3/nnnnnnnn/8/8/8/8/NNNNNNNN/4K3 w - - 0 1");
    if (type === "knightmare")
      return new Chess("r1bqkb1r/pppppppp/8/8/8/8/PPPPPPPP/NNNNKNNN w - - 0 1");
    if (type === "transcendental_chess")
      return new Chess("kqbbrnrn/pppppppp/8/8/8/8/PPPPPPPP/BRNKRNQB w - - 0 1");
    if (type === "chess960")
      return new Chess("bnrbnkrq/pppppppp/8/8/8/8/PPPPPPPP/BNRBNKRQ w - - 0 1");
    if (type === "mongredien_chess")
      return new Chess("rbbqknnr/pppppppp/8/8/8/8/PPPPPPPP/RBBQKNNR w - - 0 1");
    if (type === "fianchetto_chess")
      return new Chess("bnrqkrnb/pppppppp/8/8/8/8/PPPPPPPP/BNRQKRNB w - - 0 1");
    if (type === "vezér-huszár_chess")
      return new Chess("qqqqkqqq/pppppppp/8/8/8/PPPPPPPP/NNNNNNNN/NNNNKNNN w - - 0 1");

    return new Chess(); // alap sakk
  }, [gameType]);

  const [fen, setFen] = useState(chess.fen());
  const [over, setOver] = useState("");

  useEffect(() => {
  setFen(chess.fen());
  setOver(""); // új játék, reseteljük az eredményt
}, [chess]);

  // ♟️ Lépéskezelő függvény
  const makeAMove = useCallback(
  (moveData) => {
    try {
      const move = chess.move(moveData);
      if (!move) return null; // illegális lépés

      // Frissítsük a táblát
      const newFen = chess.fen();
      setFen(newFen);

      // --- EREDMÉNY ELLENŐRZÉS ---
          if (chess.isCheckmate()) {
        const winner = chess.turn() === "w" ? "Black" : "White";
        setOver(`Checkmate! ${winner} wins!`);
      } else if (chess.isStalemate()) {
        setOver("Stalemate! It's a draw (patthelyzet).");
      } else if (chess.isThreefoldRepetition()) {
        setOver("Draw by threefold repetition.");
      } else if (chess.isInsufficientMaterial()) {
        setOver("Draw — insufficient material (nincs elég figura a matt kényszerítéséhez).");
      } else if (
        !chess.isCheckmate() &&
        !chess.isStalemate() &&
        !chess.isThreefoldRepetition() &&
        !chess.isInsufficientMaterial() &&
        chess.isDraw()
      ) {
        setOver("Draw by 50-move rule or repetition.");
      }



      return move;
    } catch (e) {
      console.error("Illegal move:", e);
      return null;
    }
  },
  [chess]
);

  // ♟️ Lépés lehelyezése a táblán
 function onDrop(sourceSquare, targetSquare) {
  console.log("onDrop called!", sourceSquare, "→", targetSquare);

  // mindig frissítsd a chess objektumot a legutóbbi állásra!
  try {
    chess.load(fen);
  } catch (err) {
    console.error("Failed to sync chess state:", err);
  }

  if (chess.turn() !== orientation[0]) return false;
  if (players.length < 2) return false;

  const moveData = {
    from: sourceSquare,
    to: targetSquare,
    color: chess.turn(),
    promotion: "q",
  };

  const move = makeAMove(moveData);
  if (move === null) return false;

  socket.emit("move", {
    move,
    room,
    fen: chess.fen(),
  });

  return true;
}

  // ♟️ Ellenfél lépésének fogadása
  useEffect(() => {
    const handleMove = ({ move, fen }) => {
      try {
        console.log("♟ Received move from opponent:", move);
        if (fen && fen !== chess.fen()) {
          chess.load(fen);
          setFen(fen);
        }
      } catch (err) {
        console.error("Failed to load remote FEN:", err);
      }
    };

    socket.on("move", handleMove);
    return () => socket.off("move", handleMove);
  }, [chess]);

  // 🔌 Ellenfél kilépése
  useEffect(() => {
    const handleDisconnect = (player) => {
      console.log("Player disconnected:", player);
      setOver(`${player.username} has disconnected`);
    };

    socket.on("playerDisconnected", handleDisconnect);
    return () => socket.off("playerDisconnected", handleDisconnect);
  }, []);

  // 🔒 Szoba bezárás
  useEffect(() => {
    socket.on("closeRoom", ({ roomId }) => {
      if (roomId === room) cleanup();
    });
  }, [room, cleanup]);

  // 🎨 Megjelenítés
  return (
    <Stack>
      <Card>
        <CardContent>
          <Typography variant="h5">Room ID: {room}</Typography>
        </CardContent>
      </Card>

      <Stack flexDirection="row" sx={{ pt: 2 }}>
        <div
          className="board"
          style={{ maxWidth: 600, maxHeight: 600, flexGrow: 1 }}
        >
          <Chessboard
            position={fen}
            onPieceDrop={onDrop}
            boardOrientation={orientation}
          />
        </div>

        {players.length > 0 && (
          <Box>
            <List>
              <ListSubheader>Players</ListSubheader>
              {players.map((p) => (
                <ListItem key={p.id}>
                  <ListItemText primary={p.username} />
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </Stack>

{/* {over && (
  <CustomDialog
    open={true}
    title="Game Over"
    contentText={over}
    handleContinue={() => {
      socket.emit("closeRoom", { roomId: room });
      cleanup();
      setOver("");
    }}
  />
)} */}

<CustomDialog
  open={Boolean(over)}
  title="Game Over"
  contentText={over}
  handleContinue={() => {
    socket.emit("closeRoom", { roomId: room });
    cleanup();
    setOver(""); // reset state
  }}
/>




    </Stack>
  );
}

export default Game;
