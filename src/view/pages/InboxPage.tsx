import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import EditIcon from "@mui/icons-material/Edit";
import InboxIcon from "@mui/icons-material/Inbox";
import AppLayout from "../moles/AppLayout";
import ThreadList from "../moles/ThreadList";
import FloatingActionButton from "../atoms/FloatingActionButton";
import { useData } from "../../nonview/core/DataContext";

function InboxPage() {
  const { threads, loading, page, total, pageSize, pageLoading, nextPage, prevPage, refreshFolder } =
    useData();
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
        page={page.inbox || 0}
        total={total.inbox || 0}
        pageSize={pageSize}
        pageLoading={pageLoading.inbox}
        onNext={searchQuery ? undefined : () => nextPage("inbox")}
        onPrev={searchQuery ? undefined : () => prevPage("inbox")}
        onRefresh={searchQuery ? undefined : () => refreshFolder("inbox")}
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
