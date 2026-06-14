import React, { useState } from "react";
import DraftsIcon from "@mui/icons-material/Drafts";
import AppLayout from "../moles/AppLayout";
import ThreadList from "../moles/ThreadList";
import { useData } from "../../nonview/core/DataContext";

function DraftsPage() {
  const { drafts, loading } = useData();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredThreads = drafts.filter((thread) => {
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
      title="Drafts"
      titleIcon={DraftsIcon}
      showSearch
      onSearch={setSearchQuery}
    >
      <ThreadList
        threads={filteredThreads}
        loading={loading}
        emptyMessage={searchQuery ? "No drafts match your search" : "No drafts"}
      />
    </AppLayout>
  );
}

export default DraftsPage;
