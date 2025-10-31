// src/components/CustomDialog.js
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from "@mui/material";

export default function CustomDialog({ open, children, title, contentText, handleContinue }){
  return (
    <Dialog
      open={open}
      onClose={handleContinue}
      keepMounted
      disableEnforceFocus
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{contentText}</DialogContentText>
        {children}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleContinue}>Continue</Button>
      </DialogActions>
    </Dialog>
  )
}
