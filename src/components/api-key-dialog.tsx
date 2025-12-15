"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useLocalStorage } from "@/hooks/use-local-storage";

export const GATEWAY_API_KEY_STORAGE_KEY = "gateway-api-key";

interface ApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiKeyDialog({ open, onOpenChange }: ApiKeyDialogProps) {
  const [apiKey, setApiKey, removeApiKey] = useLocalStorage<string>(
    GATEWAY_API_KEY_STORAGE_KEY,
    ""
  );
  const [apiKeyInput, setApiKeyInput] = React.useState("");

  // Sync input with stored value when dialog opens
  React.useEffect(() => {
    if (open) {
      setApiKeyInput(apiKey);
    }
  }, [open, apiKey]);

  const handleSaveApiKey = () => {
    if (apiKeyInput.trim()) {
      setApiKey(apiKeyInput.trim());
      toast.success("API key saved");
    } else {
      removeApiKey();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enter Vercel Gateway API Key</DialogTitle>
          <DialogDescription>
            Please enter your Vercel Gateway API key to use AI features. Your
            key will be stored locally in your browser.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 flex flex-col gap-2">
          <Input
            type="password"
            placeholder="vck_..."
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && apiKeyInput.trim()) {
                handleSaveApiKey();
              }
            }}
            autoFocus
          />
          <div className="text-sm text-muted-foreground">
            <button
              className="underline"
              onClick={() => {
                setApiKeyInput("demo");
              }}
            >
              Use a demo key
            </button>
            &nbsp;(generations will always be the same)
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveApiKey}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
