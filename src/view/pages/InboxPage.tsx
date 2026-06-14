import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import EditIcon from "@mui/icons-material/Edit";
import InboxIcon from "@mui/icons-material/Inbox";
import AppLayout from "../moles/AppLayout";
import ThreadList from "../moles/ThreadList";
import FloatingActionButton from "../atoms/FloatingActionButton";
import { useData } from "../../nonview/core/DataContext";

function InboxPage() {
  const { threads, loading } = useData();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredThreads = threads.filter((thread) => {
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
      title="Inbox"
      titleIcon={InboxIcon}
      showSearch
      onSearch={setSearchQuery}
    >
      <ThreadList
        threads={filteredThreads}
        loading={loading}
        emptyMessage={
          searchQuery ? "No emails match your search" : "Your inbox is empty"
        }
      />
      <FloatingActionButton
        icon={EditIcon}
        onClick={() => navigate("/compose")}
        ariaLabel="compose email"
      />
    </AppLayout>
  );
}

export default InboxPage;
