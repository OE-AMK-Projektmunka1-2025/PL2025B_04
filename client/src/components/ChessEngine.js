// src/components/ChessEngine.js
export const initialBoard = (type = "alap") => {
  switch(type){
    case "paraszthaboru":
      return [
        [null,null,null,null,"k",null,null,null],
        ["p","p","p","p","p","p","p","p"],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        ["P","P","P","P","P","P","P","P"],
        [null,null,null,null,"K",null,null,null],
      ];
    case "lovakcsata":
      return [
        [null,null,null,null,"k",null,null,null],
        ["n","n","n","n","n","n","n","n"],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        ["N","N","N","N","N","N","N","N"],
        [null,null,null,null,"K",null,null,null],
      ];
    case "alap":
    default:
      return [
        ["r","n","b","q","k","b","n","r"],
        ["p","p","p","p","p","p","p","p"],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        ["P","P","P","P","P","P","P","P"],
        ["R","N","B","Q","K","B","N","R"]
      ];
  }
};

export const isWhite = (piece) => piece && piece === piece.toUpperCase();
export const isBlack = (piece) => piece && piece === piece.toLowerCase();
const cloneBoard = (board) => board.map(row => [...row]);

export const squareToCoord = (square) => [8 - parseInt(square[1]), square.charCodeAt(0) - 97];
export const coordToSquare = (x, y) => String.fromCharCode(97 + y) + (8 - x);

export function getValidMoves(board, fromX, fromY) {
  const moves = [];
  const piece = board[fromX][fromY];
  if (!piece) return moves;
  const wTurn = isWhite(piece);
  const addMove = (toX,toY) => {
    if(toX<0||toX>7||toY<0||toY>7) return;
    const target = board[toX][toY];
    if(!target || (wTurn && isBlack(target)) || (!wTurn && isWhite(target))) moves.push([toX,toY]);
  };

  switch(piece.toLowerCase()){
    case "p": {
      const dir = wTurn?-1:1;
      if(!board[fromX+dir][fromY]) moves.push([fromX+dir,fromY]);
      if((wTurn && fromX===6 || !wTurn && fromX===1) && !board[fromX+dir][fromY] && !board[fromX+dir*2][fromY])
        moves.push([fromX+dir*2,fromY]);
      for(let dy of [-1,1]){
        const tx = fromX+dir, ty = fromY+dy;
        if(tx<0||tx>7||ty<0||ty>7) continue;
        const target = board[tx][ty];
        if(target && ((wTurn && isBlack(target)) || (!wTurn && isWhite(target)))) moves.push([tx,ty]);
      }
      break;
    }
    case "n": [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dx,dy])=>addMove(fromX+dx,fromY+dy)); break;
    case "b": [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dx,dy])=>{
      for(let i=1;i<8;i++){
        const x=fromX+dx*i,y=fromY+dy*i;
        if(x<0||x>7||y<0||y>7) break;
        const target = board[x][y];
        if(!target) moves.push([x,y]);
        else { if((wTurn && isBlack(target))||(!wTurn && isWhite(target))) moves.push([x,y]); break; }
      }
    }); break;
    case "r": [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dx,dy])=>{
      for(let i=1;i<8;i++){
        const x=fromX+dx*i,y=fromY+dy*i;
        if(x<0||x>7||y<0||y>7) break;
        const target = board[x][y];
        if(!target) moves.push([x,y]);
        else { if((wTurn && isBlack(target))||(!wTurn && isWhite(target))) moves.push([x,y]); break; }
      }
    }); break;
    case "q": [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dx,dy])=>{
      for(let i=1;i<8;i++){
        const x=fromX+dx*i,y=fromY+dy*i;
        if(x<0||x>7||y<0||y>7) break;
        const target = board[x][y];
        if(!target) moves.push([x,y]);
        else { if((wTurn && isBlack(target))||(!wTurn && isWhite(target))) moves.push([x,y]); break; }
      }
    }); break;
    case "k": for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++){ if(dx===0 && dy===0) continue; addMove(fromX+dx,fromY+dy); } break;
  }
  return moves;
}

export function makeMove(board, fromX, fromY, toX, toY){
  const newBoard=cloneBoard(board);
  const piece=newBoard[fromX][fromY];
  newBoard[toX][toY]=piece;
  newBoard[fromX][fromY]=null;
  if(piece.toLowerCase()==="p"){
    if((piece==="P"&&toX===0)||(piece==="p"&&toX===7)) newBoard[toX][toY]=piece==="P"?"Q":"q";
  }
  return newBoard;
}

export function checkWin(board){
  const wKing=board.flat().includes("K");
  const bKing=board.flat().includes("k");
  if(!wKing) return "Black";
  if(!bKing) return "White";
  return null;
}

// Új: játékállapot ellenőrzés modalhoz
export function getGameStatus(board, wTurn, history=[]){
  // Checkmate
  const winner = checkWin(board);
  if(winner) return { status: "checkmate", winner };

  // Stalemate
  let hasValidMove = false;
  for(let x=0;x<8;x++){
    for(let y=0;y<8;y++){
      const piece = board[x][y];
      if(!piece) continue;
      if((wTurn && isWhite(piece))||(!wTurn && isBlack(piece))){
        const moves = getValidMoves(board,x,y);
        if(moves.length>0) hasValidMove=true;
      }
    }
  }
  if(!hasValidMove) return { status:"stalemate" };

  // Insufficient material
  const pieces = board.flat().filter(p=>p);
  const wPieces = pieces.filter(isWhite);
  const bPieces = pieces.filter(isBlack);
  const minimalMaterial = arr => arr.every(p=>["K","B","N","k","b","n"].includes(p));
  if(minimalMaterial(wPieces) && minimalMaterial(bPieces)) return { status:"insufficient" };

  // Threefold repetition
  const currentFen = JSON.stringify(board);
  const occurrences = history.filter(h=>JSON.stringify(h)===currentFen).length;
  if(occurrences >= 3) return { status:"threefold" };

  return { status:"playing" };
}
