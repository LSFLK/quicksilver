import React, { useState } from "react";
import { Box, useMediaQuery, useTheme } from "@mui/material";
import Sidebar from "./Sidebar";
import Header from "./Header";
import MobileNavBar from "./MobileNavBar";

const AppLayout = ({
  children,
  title,
  titleIcon,
  showSearch = false,
  onSearch,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {/* Desktop Sidebar */}
      {!isMobile && <Sidebar />}

      {/* Main Content Area */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Mobile/Desktop Header */}
        <Header
          title={title}
          titleIcon={titleIcon}
          showBack={false}
          onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          showSearch={showSearch}
          onSearch={onSearch}
        />

        {/* Page Content */}
        <Box
          component="main"
          sx={{
            flex: 1,
            overflow: "auto",
            backgroundColor: "background.default",
            pb: isMobile ? "56px" : 0, // Bottom padding for mobile nav bar
          }}
        >
          {children}
        </Box>

        {/* Mobile Bottom Navigation */}
        {isMobile && <MobileNavBar />}
      </Box>
    </Box>
  );
};

export default AppLayout;
