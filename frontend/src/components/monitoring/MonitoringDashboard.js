import React, { useState } from 'react';
import { Container, Row, Col, Nav, Tab, Alert } from 'react-bootstrap';
import { isUserAdmin } from '../../utils/permissions';
import SystemHealth from './SystemHealth';
import SystemMetrics from './SystemMetrics';
import LogViewer from './LogViewer';
import DatabaseMonitor from './DatabaseMonitor';
import UserActivity from './UserActivity';

const MonitoringDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');

  // Check if the current user is an admin
  const isAdmin = isUserAdmin();

  if (!isAdmin) {
    return (
      <Alert variant="danger" className="mt-4">
        <Alert.Heading>Access Denied</Alert.Heading>
        <p>
          You don't have permission to access the monitoring dashboard.
          This area is restricted to administrators only.
        </p>
      </Alert>
    );
  }
  
  return (
    <div>
      <Tab.Container id="monitoring-tabs" activeKey={activeTab} onSelect={setActiveTab}>
        <Row>
          <Col md={3} lg={2}>
            <Nav variant="pills" className="flex-column mb-4">
              <Nav.Item>
                <Nav.Link eventKey="overview">Overview</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="metrics">System Metrics</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="logs">Application Logs</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="database">Database Performance</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link eventKey="users">User Activity</Nav.Link>
              </Nav.Item>
            </Nav>
          </Col>
          
          <Col md={9} lg={10}>
            <Tab.Content>
              <Tab.Pane eventKey="overview">
                <SystemHealth />
                <Row>
                  <Col md={6}>
                    <Alert variant="info">
                      <Alert.Heading>Monitoring Dashboard</Alert.Heading>
                      <p>
                        Welcome to the monitoring dashboard. Use the tabs to navigate between
                        different monitoring features. This overview page shows the most
                        important system health metrics at a glance.
                      </p>
                    </Alert>
                  </Col>
                  <Col md={6}>
                    <Alert variant="light">
                      <Alert.Heading>Quick Tips</Alert.Heading>
                      <ul>
                        <li>Check the CPU, Memory, and Disk usage under <strong>System Metrics</strong></li>
                        <li>View application logs and filter by level under <strong>Application Logs</strong></li>
                        <li>Monitor slow database queries under <strong>Database Performance</strong></li>
                        <li>Track user logins and activity under <strong>User Activity</strong></li>
                      </ul>
                    </Alert>
                  </Col>
                </Row>
              </Tab.Pane>
              
              <Tab.Pane eventKey="metrics">
                <SystemMetrics />
              </Tab.Pane>
              
              <Tab.Pane eventKey="logs">
                <LogViewer />
              </Tab.Pane>
              
              <Tab.Pane eventKey="database">
                <DatabaseMonitor />
              </Tab.Pane>
              
              <Tab.Pane eventKey="users">
                <UserActivity />
              </Tab.Pane>
            </Tab.Content>
          </Col>
        </Row>
      </Tab.Container>
    </div>
  );
};

export default MonitoringDashboard; 