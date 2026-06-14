import React, { useState } from "react";
import SendIcon from "@mui/icons-material/Send";
import AppLayout from "../moles/AppLayout";
import ThreadList from "../moles/ThreadList";
import { useData } from "../../nonview/core/DataContext";

function SentPage() {
  const { sentThreads, loading } = useData();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredThreads = sentThreads.filter((thread) => {
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
      title="Sent"
      titleIcon={SendIcon}
      showSearch
      onSearch={setSearchQuery}
    >
      <ThreadList
        threads={filteredThreads}
        loading={loading}
        emptyMessage={
          searchQuery ? "No sent emails match your search" : "No sent emails"
        }
      />
    </AppLayout>
  );
}

export default SentPage;
