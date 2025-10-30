import React, { useState } from "react";
import { Box } from "@mui/material";

// Unicode sakkbábuk
const pieceSymbols = {
  p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚",
  P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔",
};



export default function CustomBoard({ position, onMove, orientation = "white" }) {
  const [selected, setSelected] = useState(null);
  const rows = 8;
  const cols = 8;

  const handleClick = (square) => {
    if (selected) {
      if (selected !== square) {
        onMove(selected, square);
      }
      setSelected(null);
    } else if (position[square]) {
      setSelected(square);
    }
  };

  const renderSquare = (row, col) => {
    const file = String.fromCharCode(97 + col);
    const square = `${file}${row + 1}`;
    const piece = position[square];
    const isDark = (row + col) % 2 === 1;

    return (
      <Box
        key={square}
        onClick={() => handleClick(square)}
        sx={{
          width: 60,
          height: 60,
          backgroundColor: isDark ? "#769656" : "#eeeed2",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: selected === square ? "2px solid red" : "1px solid #333",
          boxSizing: "border-box",
          cursor: piece ? "pointer" : "default",
          userSelect: "none",
          fontSize: 36,
        }}
      >
        {piece ? pieceSymbols[piece] : null}
      </Box>
    );
  };

  // boardSquares generálása orientation alapján
  const boardSquares = [];
  const rowOrder = orientation === "white" ? [...Array(rows).keys()].reverse() : [...Array(rows).keys()];
  const colOrder = orientation === "white" ? [...Array(cols).keys()] : [...Array(cols).keys()].reverse();

  for (let r of rowOrder) {
    for (let c of colOrder) {
      boardSquares.push(renderSquare(r, c));
    }
  }

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateRows: `repeat(${rows}, 60px)`,
        gridTemplateColumns: `repeat(${cols}, 60px)`,
        border: "2px solid black",
        width: cols * 60,
        height: rows * 60,
      }}
    >
      {boardSquares}
    </Box>
  );
}
