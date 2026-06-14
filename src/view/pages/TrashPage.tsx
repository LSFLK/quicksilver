import React, { useState } from "react";
import DeleteIcon from "@mui/icons-material/Delete";
import AppLayout from "../moles/AppLayout";
import ThreadList from "../moles/ThreadList";
import { useData } from "../../nonview/core/DataContext";

function TrashPage() {
  const { trashedThreads, loading } = useData();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredThreads = trashedThreads.filter((thread) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      thread.subject.toLowerCase().includes(query) ||
      thread.lastMessage.toLowerCase().includes(query) ||
      thread.participants.some((p) => p.name.toLowerCase().includes(query))
    );
  });

  return (
    <AppLayout
      title="Trash"
      titleIcon={DeleteIcon}
      showSearch
      onSearch={setSearchQuery}
    >
      <ThreadList
        threads={filteredThreads}
        loading={loading}
        emptyMessage={
          searchQuery ? "No trash items match your search" : "Trash is empty"
        }
      />
    </AppLayout>
  );
}

export default TrashPage;
