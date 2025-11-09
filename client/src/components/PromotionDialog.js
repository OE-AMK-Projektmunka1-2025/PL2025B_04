import { Dialog, DialogTitle, DialogContent, Stack, Button } from "@mui/material";

export default function PromotionDialog({ open, color, onSelect }) {
  const pieces = color === "white" ? ["Q", "R", "B", "N"] : ["q", "r", "b", "n"];

  return (
    <Dialog open={open}>
      <DialogTitle>Choose promotion piece</DialogTitle>
      <DialogContent>
        <Stack direction="row" spacing={2} justifyContent="center">
          {pieces.map((p) => (
            <Button
              key={p}
              variant="outlined"
              onClick={() => onSelect(p)}
              sx={{ fontSize: "2rem" }}
            >
              {p === "Q" || p === "q" ? "♛" :
               p === "R" || p === "r" ? "♜" :
               p === "B" || p === "b" ? "♝" :
               "♞"}
            </Button>
          ))}
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
