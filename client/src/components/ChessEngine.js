// src/components/ChessEngine.js

// ----- Alapállások -----
export const initialBoard = (type = "alap") => {
  switch (type) {
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

// ----- Segédfüggvények -----
export const isWhite = (piece) => piece && piece === piece.toUpperCase();
export const isBlack = (piece) => piece && piece === piece.toLowerCase();
const cloneBoard = (board) => board.map(row => [...row]);

export const squareToCoord = (square) => [8 - parseInt(square[1]), square.charCodeAt(0) - 97];
export const coordToSquare = (x, y) => String.fromCharCode(97 + y) + (8 - x);

// ----- Király keresés -----
function findKing(board, colorWhite) {
  const king = colorWhite ? "K" : "k";
  for (let i=0;i<8;i++) for (let j=0;j<8;j++) if (board[i][j] === king) return [i,j];
  return null;
}

function isEnemy(piece, target) {
  if (!piece || !target) return false;
  return isWhite(piece) !== isWhite(target);
}

// ----- Nyers lépések (sakk-ellenőrzés nélkül) -----
function getRawMoves(board, fromX, fromY, enPassantTarget = null) {
  const moves = [];
  const piece = board[fromX][fromY];
  if (!piece) return moves;
  const wTurn = isWhite(piece);

  const add = (x,y) => {
    if (x<0||x>7||y<0||y>7) return;
    const t = board[x][y];
    if (!t || isEnemy(piece,t)) moves.push([x,y]);
  };

  switch (piece.toLowerCase()) {
    case "p": {
      const dir = wTurn ? -1 : 1;
      const start = wTurn ? 6 : 1;

      // sima előrelépés
      if (!board[fromX+dir]?.[fromY]) {
        moves.push([fromX+dir, fromY]);
        // dupla lépés a kezdőhelyről
        if (fromX === start && !board[fromX+2*dir]?.[fromY]) {
          moves.push([fromX+2*dir, fromY]);
        }
      }

      // ütés átlósan
      for (const dy of [-1,1]) {
        const tx = fromX+dir, ty = fromY+dy;
        if (tx<0||tx>7||ty<0||ty>7) continue;
        const t = board[tx][ty];
        if (t && isEnemy(piece,t)) moves.push([tx,ty]);
      }

      // en passant (ha van cél)
    if (enPassantTarget) {
  const { row, col } = enPassantTarget;
  if (Math.abs(fromY - col) === 1 && fromX + dir === row) moves.push([row, col]);
}


      break;
    }

    case "n":
      [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dx,dy])=>add(fromX+dx,fromY+dy));
      break;

    case "b":
      [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dx,dy])=>{
        for (let i=1;i<8;i++) {
          const x=fromX+dx*i, y=fromY+dy*i;
          if (x<0||x>7||y<0||y>7) break;
          if (!board[x][y]) moves.push([x,y]);
          else { if (isEnemy(piece, board[x][y])) moves.push([x,y]); break; }
        }
      });
      break;

    case "r":
      [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dx,dy])=>{
        for (let i=1;i<8;i++) {
          const x=fromX+dx*i, y=fromY+dy*i;
          if (x<0||x>7||y<0||y>7) break;
          if (!board[x][y]) moves.push([x,y]);
          else { if (isEnemy(piece, board[x][y])) moves.push([x,y]); break; }
        }
      });
      break;

    case "q":
      [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dx,dy])=>{
        for (let i=1;i<8;i++) {
          const x=fromX+dx*i, y=fromY+dy*i;
          if (x<0||x>7||y<0||y>7) break;
          if (!board[x][y]) moves.push([x,y]);
          else { if (isEnemy(piece, board[x][y])) moves.push([x,y]); break; }
        }
      });
      break;

    case "k":
      for (let dx=-1;dx<=1;dx++)
        for (let dy=-1;dy<=1;dy++)
          if (dx!==0 || dy!==0) add(fromX+dx,fromY+dy);

      // sáncolás (nyers)
      if (isWhite(piece) && fromX===7 && fromY===4) {
        if (board[7][5]==null && board[7][6]==null && board[7][7]==="R") moves.push([7,6]);
        if (board[7][3]==null && board[7][2]==null && board[7][1]==null && board[7][0]==="R") moves.push([7,2]);
      }
      if (isBlack(piece) && fromX===0 && fromY===4) {
        if (board[0][5]==null && board[0][6]==null && board[0][7]==="r") moves.push([0,6]);
        if (board[0][3]==null && board[0][2]==null && board[0][1]==null && board[0][0]==="r") moves.push([0,2]);
      }
      break;
  }

  return moves;
}

// ----- makeMove: kezeli az en passant-ot és a sáncolást -----
export function makeMove(board, fromX, fromY, toX, toY, promoteTo = null, enPassantTarget = null) {
  const nb = cloneBoard(board);
  const piece = nb[fromX][fromY];
  if (!piece) return nb;
  nb[fromX][fromY] = null;

  // en passant ütés
 if (piece.toLowerCase() === "p" && enPassantTarget) {
  if (toX === enPassantTarget.row && toY === enPassantTarget.col) {
      const dir = isWhite(piece) ? 1 : -1;
      nb[toX + dir][toY] = null;
    }
  }

  // sáncolás (K/k mozgás)
  if (piece === "K" && fromX === 7 && fromY === 4) {
    if (toY === 6) { nb[7][6] = "K"; nb[7][5] = "R"; nb[7][7] = null; return nb; }
    if (toY === 2) { nb[7][2] = "K"; nb[7][3] = "R"; nb[7][0] = null; return nb; }
  }
  if (piece === "k" && fromX === 0 && fromY === 4) {
    if (toY === 6) { nb[0][6] = "k"; nb[0][5] = "r"; nb[0][7] = null; return nb; }
    if (toY === 2) { nb[0][2] = "k"; nb[0][3] = "r"; nb[0][0] = null; return nb; }
  }

  nb[toX][toY] = promoteTo || piece;

  // automatikus promóció
  if (piece.toLowerCase() === "p") {
    if ((piece === "P" && toX === 0) || (piece === "p" && toX === 7))
      nb[toX][toY] = isWhite(piece) ? "Q" : "q";
  }

  return nb;
}

// ----- Sakkellenőrzés -----
function isKingInCheck(board, colorWhite) {
  const kingPos = findKing(board, colorWhite);
  if (!kingPos) return false;
  const [kx, ky] = kingPos;
  for (let i=0;i<8;i++)
    for (let j=0;j<8;j++) {
      const p = board[i][j];
      if (!p || isWhite(p) === colorWhite) continue;
      const raw = getRawMoves(board, i, j, null);
      for (const [x,y] of raw) if (x===kx && y===ky) return true;
    }
  return false;
}

// ----- Érvényes lépések -----
export function getValidMoves(board, fromX, fromY, enPassantTarget = null) {
  const raw = getRawMoves(board, fromX, fromY, enPassantTarget);
  const piece = board[fromX][fromY];
  if (!piece) return [];

  const colorWhite = isWhite(piece);
  const legal = [];

  for (const [tx, ty] of raw) {
    const test = makeMove(board, fromX, fromY, tx, ty, null, enPassantTarget);
    if (!isKingInCheck(test, colorWhite)) legal.push([tx, ty]);
  }
  return legal;
}

// ----- Játékállapot -----
export function getGameStatus(board, wTurn, history = [], enPassantTarget = null) {
  const winner = (() => {
    const wk = findKing(board, true);
    const bk = findKing(board, false);
    if (!wk) return "Black";
    if (!bk) return "White";
    return null;
  })();
  if (winner) return { status: "checkmate", winner };

  let hasAny = false;
  for (let x=0;x<8;x++)
    for (let y=0;y<8;y++) {
      const p = board[x][y];
      if (!p) continue;
      if ((wTurn && isWhite(p)) || (!wTurn && isBlack(p))) {
        const mv = getValidMoves(board, x, y, enPassantTarget);
        if (mv.length > 0) hasAny = true;
      }
    }

  if (!hasAny) {
    if (isKingInCheck(board, wTurn))
      return { status: "checkmate", winner: wTurn ? "Black" : "White" };
    return { status: "stalemate" };
  }

  return { status: "playing" };
}
