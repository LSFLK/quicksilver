import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import {
  Box,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Chip,
  TextField,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const EMAIL_RE = /\S+@\S+\.\S+/;

interface Recipient {
  id?: string;
  name?: string;
  email: string;
}

interface RecipientInputProps {
  value?: Recipient[];
  onChange: (next: Recipient[]) => void;
  suggestions?: Recipient[];
}

export interface RecipientInputHandle {
  // Commits any text currently in the input as a chip and returns the
  // resulting recipients array. Callers should use the returned value
  // directly rather than relying on the parent's state being updated.
  flushPending: () => Recipient[];
}

// RecipientInput is a chip-input for email addresses.
//
// Commits the pending text to a chip on: Enter, comma, semicolon, blur.
// Exposes flushPending() via ref so callers (e.g. ComposePage's Send button)
// can synchronously commit before submitting — bypassing the async-state-update
// race when a user types an address and immediately clicks Send.
const RecipientInput = forwardRef<RecipientInputHandle, RecipientInputProps>(
  ({ value = [], onChange, suggestions = [] }, ref) => {
  const [inputValue, setInputValue] = useState("");

  const filteredSuggestions = useMemo(() => {
    if (!inputValue) return [];
    const query = inputValue.toLowerCase();
    return suggestions.filter(
      (s) =>
        s.email.toLowerCase().includes(query) ||
        (s.name && s.name.toLowerCase().includes(query)),
    );
  }, [inputValue, suggestions]);

  // commit returns the recipients array AFTER committing the candidate.
  // The returned value is what the parent should treat as authoritative for
  // immediate side-effects (e.g. POSTing the email) since React state updates
  // are not synchronously visible.
  const commit = useCallback(
    (candidate) => {
      const trimmed = (candidate ?? "").trim().replace(/[,;]\s*$/, "");
      if (!trimmed) return value;
      if (!EMAIL_RE.test(trimmed)) return value;
      if (value.some((r) => r.email.toLowerCase() === trimmed.toLowerCase())) {
        return value;
      }
      const next = [...value, { email: trimmed }];
      onChange(next);
      return next;
    },
    [value, onChange],
  );

  const flushPending = useCallback(() => {
    const next = commit(inputValue);
    if (next !== value) setInputValue("");
    return next;
  }, [commit, inputValue, value]);

  useImperativeHandle(ref, () => ({ flushPending }), [flushPending]);

  const handleAddRecipient = (recipient) => {
    if (!recipient?.email) return;
    if (value.some((r) => r.email.toLowerCase() === recipient.email.toLowerCase())) {
      return;
    }
    onChange([...value, recipient]);
    setInputValue("");
  };

  const handleRemove = (email) => {
    onChange(value.filter((r) => r.email !== email));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === "," || e.key === ";") {
      if (!inputValue.trim()) return;
      e.preventDefault();
      flushPending();
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      // Familiar email-client gesture: backspace in empty input removes the
      // last chip.
      handleRemove(value[value.length - 1].email);
    }
  };

  const handleChange = (e) => {
    const v = e.target.value;
    // If the user pasted "a@x.com, b@x.com" or typed a comma anywhere, commit
    // each chunk left of the delimiter, keep any partial text after.
    if (v.includes(",") || v.includes(";")) {
      const parts = v.split(/[,;]/);
      let next = value;
      for (let i = 0; i < parts.length - 1; i++) {
        next = commit(parts[i]);
      }
      setInputValue(parts[parts.length - 1].trimStart());
      // commit() already called onChange when it accepted parts; ensure the
      // return value of the final committed accumulator is the one onChange
      // received last (the last commit's onChange call wins).
      if (next === value) {
        // no parts were valid; just store the raw text minus trailing delim
        setInputValue(v.replace(/[,;]\s*$/, ""));
      }
      return;
    }
    setInputValue(v);
  };

  return (
    <Box sx={{ position: "relative" }}>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        To
      </Typography>
      <Paper
        variant="outlined"
        sx={{ p: 1, display: "flex", flexWrap: "wrap", alignItems: "center" }}
      >
        {value.map((recipient) => (
          <Chip
            key={recipient.email}
            label={
              recipient.name
                ? `${recipient.name} <${recipient.email}>`
                : recipient.email
            }
            onDelete={() => handleRemove(recipient.email)}
            deleteIcon={<CloseIcon />}
            size="small"
            sx={{ mr: 0.5, mb: 0.5 }}
          />
        ))}
        <TextField
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={flushPending}
          placeholder="Add recipient"
          variant="standard"
          sx={{ flex: 1, minWidth: 200 }}
          InputProps={{ disableUnderline: true }}
          inputProps={{ inputMode: "email", autoComplete: "email" }}
        />
      </Paper>

      {filteredSuggestions.length > 0 && (
        <Paper
          sx={{
            position: "absolute",
            zIndex: 10,
            width: "100%",
            mt: 0.5,
            maxHeight: 200,
            overflowY: "auto",
          }}
        >
          <List dense>
            {filteredSuggestions.map((suggestion) => (
              <ListItem key={suggestion.id} disablePadding>
                <ListItemButton onClick={() => handleAddRecipient(suggestion)}>
                  <ListItemText
                    primary={suggestion.name || suggestion.email}
                    secondary={suggestion.email}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
});

RecipientInput.displayName = "RecipientInput";

export default RecipientInput;
