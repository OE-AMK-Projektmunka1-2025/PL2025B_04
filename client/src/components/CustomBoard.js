// src/components/CustomBoard.js
import React, { useState } from "react";
import { Box } from "@mui/material";

const pieceSymbols = {
  p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚",
  P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔",
};

export default function CustomBoard({ position, onMove, orientation="white", rows=8, cols=8 }){
  const [selected,setSelected]=useState(null);

  const handleClick=(square)=>{
    if(selected){
      if(selected!==square) onMove(selected,square);
      setSelected(null);
    } else if(position[square]) setSelected(square);
  }

  // const renderSquare=(row,col)=>{
  //   const file=String.fromCharCode(97+col);
  //   const square=`${file}${row+1}`;
  //   const piece=position[square];
  //   const isDark=(row+col)%2===1;
  const renderSquare = (row, col) => {
  const file = String.fromCharCode(97 + col);
const rank = row + 1;

  const square = `${file}${rank}`;
  const piece = position[square];
  const isDark = (row + col) % 2 === 1;

    return(
      <Box key={square} onClick={()=>handleClick(square)} sx={{
        width:60,height:60,
        backgroundColor:isDark?"#769656":"#eeeed2",
        display:"flex",alignItems:"center",justifyContent:"center",
        border:selected===square?"2px solid red":"1px solid #333",
        boxSizing:"border-box",cursor:piece?"pointer":"default",
        userSelect:"none",fontSize:36
      }}>
        {piece?pieceSymbols[piece]:null}
      </Box>
    )
  }

  // const rowOrder=orientation==="white"?[...Array(rows).keys()].reverse():[...Array(rows).keys()];
  // const colOrder=orientation==="white"?[...Array(cols).keys()]:[...Array(cols).keys()].reverse();

  // 🔄 A fehér alul, a fekete felül jelenjen meg
  // const rowOrder = [...Array(rows).keys()]; // NE fordítsd meg!
  // const colOrder = [...Array(cols).keys()]; // Szintén maradjon alap sorrendben

  // Ha fehér játékos nézi → fehér alul, fekete felül
// Ha fekete játékos nézi → fekete alul, fehér felül
// 🔄 Tájolás: fehér felől nézve a tábla alulról indul
const rowOrder = orientation === "white"
  ? [...Array(rows).keys()].reverse() // fehér: alul → felül
  : [...Array(rows).keys()];          // fekete: felül → alul

const colOrder = orientation === "white"
  ? [...Array(cols).keys()]           // fehér: balról jobbra
  : [...Array(cols).keys()].reverse();// fekete: jobbról balra



  const boardSquares=[];
  for(let r of rowOrder) for(let c of colOrder) boardSquares.push(renderSquare(r,c));

  return(
    <Box sx={{
      display:"grid",
      gridTemplateRows:`repeat(${rows},60px)`,
      gridTemplateColumns:`repeat(${cols},60px)`,
      border:"2px solid black",
      width: cols*60, height: rows*60,
      overflow: "visible",
        margin: "10px auto",
    }}>
      {boardSquares}
    </Box>
  )
}
