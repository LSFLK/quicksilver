import React, { useState } from "react";
import DeleteIcon from "@mui/icons-material/Delete";
import AppLayout from "../moles/AppLayout";
import ThreadList from "../moles/ThreadList";
import { useData } from "../../nonview/core/DataContext";

function TrashPage() {
  const {
    trashedThreads,
    loading,
    page,
    total,
    pageSize,
    pageLoading,
    nextPage,
    prevPage,
    refreshFolder,
  } = useData();
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
        page={page.trash || 0}
        total={total.trash || 0}
        pageSize={pageSize}
        pageLoading={pageLoading.trash}
        onNext={searchQuery ? undefined : () => nextPage("trash")}
        onPrev={searchQuery ? undefined : () => prevPage("trash")}
        onRefresh={searchQuery ? undefined : () => refreshFolder("trash")}
      />
    </AppLayout>
  );
}

export default TrashPage;
