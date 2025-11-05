// src/components/ChessEngine.js

// ----- Alapállások -----
export const initialBoard = (type = "alap") => {
  switch (type) {
    case "paraszthaboru":
      return [
        [null, null, null, null, null, null, null, null],
        ["p", "p", "p", "p", "p", "p", "p", "p"],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        ["P", "P", "P", "P", "P", "P", "P", "P"],
        [null, null, null, null, null, null, null, null],
      ];
    case "alap":
    default:
      return [
        ["r", "n", "b", "q", "k", "b", "n", "r"],
        ["p", "p", "p", "p", "p", "p", "p", "p"],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        ["P", "P", "P", "P", "P", "P", "P", "P"],
        ["R", "N", "B", "Q", "K", "B", "N", "R"],
      ];
  }
};

// ----- Segédfüggvények -----
export const isWhite = (piece) => piece && piece === piece.toUpperCase();
export const isBlack = (piece) => piece && piece === piece.toLowerCase();
const cloneBoard = (board) => board.map((row) => [...row]);
export const squareToCoord = (square) => [8 - parseInt(square[1]), square.charCodeAt(0) - 97];
export const coordToSquare = (x, y) => String.fromCharCode(97 + y) + (8 - x);

// ----- Király keresés -----
function findKing(board, colorWhite) {
  const king = colorWhite ? "K" : "k";
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 8; j++) if (board[i][j] === king) return [i, j];
  return null;
}

function isEnemy(piece, target) {
  if (!piece || !target) return false;
  return isWhite(piece) !== isWhite(target);
}

// ----- Nyers lépések -----
function getRawMoves(board, fromX, fromY, enPassantTarget = null) {
  const moves = [];
  if (!board || !Array.isArray(board)) return moves;
  const piece = board[fromX]?.[fromY];
  if (!piece) return moves;
  const wTurn = isWhite(piece);
  const add = (x, y) => {
    if (x < 0 || x > 7 || y < 0 || y > 7) return;
    const t = board[x][y];
    if (!t || isEnemy(piece, t)) moves.push([x, y]);
  };

  switch (piece.toLowerCase()) {
    case "p": {
      const dir = wTurn ? -1 : 1;
      const start = wTurn ? 6 : 1;

      if (!board[fromX + dir]?.[fromY]) {
        moves.push([fromX + dir, fromY]);
        if (fromX === start && !board[fromX + 2 * dir]?.[fromY])
          moves.push([fromX + 2 * dir, fromY]);
      }

      for (const dy of [-1, 1]) {
        const tx = fromX + dir,
          ty = fromY + dy;
        if (tx < 0 || tx > 7 || ty < 0 || ty > 7) continue;
        const t = board[tx][ty];
        if (t && isEnemy(piece, t)) moves.push([tx, ty]);
      }

      if (enPassantTarget) {
        const { row, col } = enPassantTarget;
        if (Math.abs(fromY - col) === 1 && fromX + dir === row)
          moves.push([row, col]);
      }
      break;
    }

    case "n":
      [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]].forEach(([dx, dy]) =>
        add(fromX + dx, fromY + dy)
      );
      break;

    case "b":
      [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([dx, dy]) => {
        for (let i = 1; i < 8; i++) {
          const x = fromX + dx * i,
            y = fromY + dy * i;
          if (x < 0 || x > 7 || y < 0 || y > 7) break;
          if (!board[x][y]) moves.push([x, y]);
          else {
            if (isEnemy(piece, board[x][y])) moves.push([x, y]);
            break;
          }
        }
      });
      break;

    case "r":
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => {
        for (let i = 1; i < 8; i++) {
          const x = fromX + dx * i,
            y = fromY + dy * i;
          if (x < 0 || x > 7 || y < 0 || y > 7) break;
          if (!board[x][y]) moves.push([x, y]);
          else {
            if (isEnemy(piece, board[x][y])) moves.push([x, y]);
            break;
          }
        }
      });
      break;

    case "q":
      [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([dx, dy]) => {
        for (let i = 1; i < 8; i++) {
          const x = fromX + dx * i,
            y = fromY + dy * i;
          if (x < 0 || x > 7 || y < 0 || y > 7) break;
          if (!board[x][y]) moves.push([x, y]);
          else {
            if (isEnemy(piece, board[x][y])) moves.push([x, y]);
            break;
          }
        }
      });
      break;

    case "k":
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          if (dx !== 0 || dy !== 0) add(fromX + dx, fromY + dy);

      if (isWhite(piece) && fromX === 7 && fromY === 4) {
        if (board[7][5] == null && board[7][6] == null && board[7][7] === "R")
          moves.push([7, 6]);
        if (
          board[7][3] == null &&
          board[7][2] == null &&
          board[7][1] == null &&
          board[7][0] === "R"
        )
          moves.push([7, 2]);
      }
      if (!isWhite(piece) && fromX === 0 && fromY === 4) {
        if (board[0][5] == null && board[0][6] == null && board[0][7] === "r")
          moves.push([0, 6]);
        if (
          board[0][3] == null &&
          board[0][2] == null &&
          board[0][1] == null &&
          board[0][0] === "r"
        )
          moves.push([0, 2]);
      }
      break;
  }

  return moves;
}

// ----- makeMove -----
export function makeMove(board, fromX, fromY, toX, toY, promoteTo = null, enPassantTarget = null, type = "alap") {
  // --- Parasztháború ---
  if (type === "paraszthaboru") {
    const nb = cloneBoard(board);
    nb[toX][toY] = nb[fromX][fromY];
    nb[fromX][fromY] = null;
    return nb;
  }

  // --- Eredeti sakk logika ---
  const nb = cloneBoard(board);
  const piece = nb[fromX][fromY];
  if (!piece) return nb;
  nb[fromX][fromY] = null;

  if (piece.toLowerCase() === "p" && enPassantTarget) {
    if (toX === enPassantTarget.row && toY === enPassantTarget.col) {
      const dir = isWhite(piece) ? 1 : -1;
      nb[toX + dir][toY] = null;
    }
  }

  if (piece === "K" && fromX === 7 && fromY === 4) {
    if (toY === 6) {
      nb[7][6] = "K";
      nb[7][5] = "R";
      nb[7][7] = null;
      return nb;
    }
    if (toY === 2) {
      nb[7][2] = "K";
      nb[7][3] = "R";
      nb[7][0] = null;
      return nb;
    }
  }
  if (piece === "k" && fromX === 0 && fromY === 4) {
    if (toY === 6) {
      nb[0][6] = "k";
      nb[0][5] = "r";
      nb[0][7] = null;
      return nb;
    }
    if (toY === 2) {
      nb[0][2] = "k";
      nb[0][3] = "r";
      nb[0][0] = null;
      return nb;
    }
  }

  nb[toX][toY] = promoteTo || piece;

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
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 8; j++) {
      const p = board[i][j];
      if (!p || isWhite(p) === colorWhite) continue;
      const raw = getRawMoves(board, i, j, null);
      for (const [x, y] of raw) if (x === kx && y === ky) return true;
    }
  return false;
}

// ----- Érvényes lépések -----
export function getValidMoves(board, fromX, fromY, enPassantTarget = null, type = "alap") {
  // --- Parasztháború logika ---
  if (type === "paraszthaboru") {
    const piece = board[fromX][fromY];
    if (!piece) return [];

    const w = isWhite(piece);
    const dir = w ? -1 : 1;
    const start = w ? 6 : 1;
    const moves = [];

    // 1 lépés előre
    if (board[fromX + dir]?.[fromY] === null) {
      moves.push([fromX + dir, fromY]);

      // 2 lépés előre (induló sorból)
      if (
        fromX === start &&
        board[fromX + dir]?.[fromY] === null &&
        board[fromX + 2 * dir]?.[fromY] === null
      ) {
        moves.push([fromX + 2 * dir, fromY]);
      }
    }

    // Átlós ütés
    for (const dy of [-1, 1]) {
      const tx = fromX + dir;
      const ty = fromY + dy;
      if (tx >= 0 && tx < 8 && ty >= 0 && ty < 8) {
        const target = board[tx][ty];
        if (target && isWhite(piece) !== isWhite(target)) {
          moves.push([tx, ty]);
        }
      }
    }

    // Hátralépés tiltása
    return moves.filter(([tx]) => (w ? tx < fromX : tx > fromX));
  }

  // --- Eredeti sakk logika ---
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

// ----- Insufficient material -----
function isInsufficientMaterial(board) {
  const pieces = [];
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 8; j++) {
      const p = board[i][j];
      if (p) pieces.push(p);
    }

  if (pieces.length === 2 && pieces.every((p) => p.toLowerCase() === "k"))
    return true;
  if (pieces.length === 3) {
    const minor = pieces.find((p) => !["K", "k"].includes(p));
    if (minor && ["B", "b", "N", "n"].includes(minor)) return true;
  }
  if (pieces.length === 4) {
    const knights = pieces.filter((p) => p.toLowerCase() === "n").length;
    const others = pieces.filter(
      (p) => !["k", "n"].includes(p.toLowerCase())
    ).length;
    if (knights === 2 && others === 0) return true;
  }

  return false;
}

// ----- Threefold repetition -----
function boardHash(board, wTurn, enPassantTarget) {
  if (!board || !Array.isArray(board)) return "";
  const layout = board.map((r) => r.map((c) => c || ".").join("")).join("/");
  const ep = enPassantTarget
    ? `${enPassantTarget.row},${enPassantTarget.col}`
    : "-";
  return `${layout}_${wTurn ? "W" : "B"}_${ep}`;
}

function isThreefoldRepetition(board, wTurn, history = [], enPassantTarget) {
  if (!Array.isArray(history)) return false;
  const currentHash = boardHash(board, wTurn, enPassantTarget);
  if (!currentHash) return false;

  let occurrences = 0;
  for (const entry of history) {
    if (!entry) continue;
    if (entry.board && Array.isArray(entry.board)) {
      const h = boardHash(entry.board, !!entry.wTurn, entry.enPassantTarget);
      if (h === currentHash) occurrences++;
    } else if (Array.isArray(entry)) {
      const h1 = boardHash(entry, true, null);
      const h2 = boardHash(entry, false, null);
      if (h1 === currentHash || h2 === currentHash) occurrences++;
    }
    if (occurrences >= 3) return true;
  }
  return occurrences >= 3;
}

// ----- Játékállapot -----
export function getGameStatus(board, wTurn, history = [], enPassantTarget = null, type = "alap") {
  // --- Parasztháború ---
  if (type === "paraszthaboru") {
    // --- Győzelem: ha gyalog beért az alapsorra vagy az ellenfél összes gyalogját leütötték ---
    let whitePawns = 0;
    let blackPawns = 0;
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        if (board[i][j] === "P") whitePawns++;
        if (board[i][j] === "p") blackPawns++;
      }
    }

    const whiteReached = board[0]?.some((p) => p === "P");
    const blackReached = board[7]?.some((p) => p === "p");

    if (whiteReached || blackReached || whitePawns === 0 || blackPawns === 0) {
      if (whiteReached || blackPawns === 0)
        return { status: "finished", winner: "White" };
      if (blackReached || whitePawns === 0)
        return { status: "finished", winner: "Black" };
    }

    // --- Ha a következő játékos nem tud lépni → veszít ---
    const nextIsWhite = !wTurn;
    const canMove = board.some((r, i) =>
      r.some((p, j) => {
        if (!p) return false;
        if (isWhite(p) !== nextIsWhite) return false;
        return getValidMoves(board, i, j, null, "paraszthaboru").length > 0;
      })
    );

    if (!canMove)
      return { status: "finished", winner: wTurn ? "White" : "Black" };

    return { status: "playing" };
  }

  // --- Eredeti sakklogika ---
  if (!board) return { status: "playing" };
  if (isInsufficientMaterial(board)) return { status: "insufficient" };
  if (isThreefoldRepetition(board, wTurn, history, enPassantTarget))
    return { status: "threefold" };

  const wk = findKing(board, true);
  const bk = findKing(board, false);
  if (!wk) return { status: "checkmate", winner: "Black" };
  if (!bk) return { status: "checkmate", winner: "White" };

  let hasMove = false;
  for (let x = 0; x < 8; x++)
    for (let y = 0; y < 8; y++) {
      const p = board[x][y];
      if (!p) continue;
      if ((wTurn && isWhite(p)) || (!wTurn && isBlack(p))) {
        const mv = getValidMoves(board, x, y, enPassantTarget);
        if (mv.length > 0) hasMove = true;
      }
    }

  if (!hasMove) {
    if (isKingInCheck(board, wTurn))
      return { status: "checkmate", winner: wTurn ? "Black" : "White" };
    return { status: "stalemate" };
  }

  return { status: "playing" };
}
