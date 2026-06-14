import React, { useState } from "react";
import { InputBase, Paper, IconButton } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";

const SearchBar = ({ onSearch, placeholder = "Search..." }) => {
  const [value, setValue] = useState("");

  const handleChange = (e) => {
    const newValue = e.target.value;
    setValue(newValue);
    if (onSearch) {
      onSearch(newValue);
    }
  };

  const handleClear = () => {
    setValue("");
    if (onSearch) {
      onSearch("");
    }
  };

  return (
    <Paper
      component="form"
      onSubmit={(e) => e.preventDefault()}
      sx={{
        p: "2px 8px",
        display: "flex",
        alignItems: "center",
        backgroundColor: "action.hover",
        boxShadow: "none",
        border: 1,
        borderColor: "divider",
      }}
    >
      <SearchIcon sx={{ color: "text.secondary", mr: 1 }} />
      <InputBase
        sx={{ ml: 1, flex: 1 }}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        inputProps={{ "aria-label": placeholder }}
      />
      {value && (
        <IconButton
          onClick={handleClear}
          aria-label="clear search"
          size="small"
        >
          <CloseIcon />
        </IconButton>
      )}
    </Paper>
  );
};

export default SearchBar;
