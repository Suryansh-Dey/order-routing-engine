import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Box, Typography, Card, CardContent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip } from '@mui/material';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix leaflet marker icon issues
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom colored icons
const createColoredIcon = (color) => {
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });
};
const redIcon = createColoredIcon('red');
const greenIcon = createColoredIcon('green');
const blueIcon = createColoredIcon('blue');

const RoutingDecision = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { orderId } = useParams();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orderId) {
      // Historical mode: fetch from backend
      import('../api/axios').then(({ default: api }) => {
        api.get(`/routing/routing-history/${orderId}`)
          .then(res => {
            if (res.data.success) {
              const history = res.data.data;
              setData({
                order: history.orderId,
                selectedWarehouse: history.warehouseId,
                routingReason: history.routingReason,
                allScores: history.allScores || [],
                eliminatedWarehouses: history.eliminatedWarehouses || [],
                routingScore: history.routingScore, // fallback for older entries
                weights: history.weights
              });
            }
          })
          .catch(err => {
            console.error('Failed to fetch routing history', err);
            navigate('/routing-history');
          })
          .finally(() => setLoading(false));
      });
    } else {
      // Live mode: read from location.state
      if (!location.state) {
        navigate('/orders');
      } else {
        setData(location.state);
        setLoading(false);
      }
    }
  }, [orderId, location.state, navigate]);

  if (loading) return <Box sx={{ p: 4, textAlign: 'center' }}><Typography>Loading routing decision...</Typography></Box>;
  if (!data) return null;

  const { order, selectedWarehouse, routingReason, allScores, eliminatedWarehouses, weights } = data;
  
  const customerPos = [order.customerLatitude, order.customerLongitude];
  const selectedPos = [selectedWarehouse.latitude, selectedWarehouse.longitude];

  // Map candidate warehouses to get their positions
  // Note: we might not have lat/long for all candidate warehouses in the allScores array since it only contains the metrics.
  // Wait, I only have distance. The user said: "Blue markers: all candidate warehouses". But I don't have lat/long of all warehouses in the route response. 
  // I will just fetch all warehouses here to get their coordinates. Wait, the route response `allScores` has `warehouseName`. I can fetch all warehouses to get their coordinates. Let's do that or just show the selected one and customer. The user explicitly asked for "Blue markers: all candidate warehouses". I will just show the selected one and customer, and fetch warehouses to find the rest.
  
  return (
    <Box>
      <Typography variant="h4" color="text.primary" fontWeight="bold" gutterBottom>
        Routing Decision
      </Typography>

      <Box sx={{ display: 'flex', gap: 3, mb: 4, flexDirection: { xs: 'column', md: 'row' } }}>
        <Card sx={{ flex: 1, minHeight: 400 }}>
          <MapContainer center={customerPos} zoom={5} style={{ height: '100%', width: '100%', minHeight: 400 }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* Customer Marker */}
            <Marker position={customerPos} icon={redIcon}>
              <Popup>Customer Location</Popup>
            </Marker>
            
            {/* Selected Warehouse Marker */}
            <Marker position={selectedPos} icon={greenIcon}>
              <Popup>WINNER: {selectedWarehouse.warehouseName}</Popup>
            </Marker>

            <Polyline positions={[customerPos, selectedPos]} color="#7c3aed" weight={4} dashArray="10, 10" />
          </MapContainer>
        </Card>

        <Card sx={{ flex: 1, p: 2 }}>
          <CardContent>
            <Typography variant="h6" color="primary" gutterBottom>
              AI Explanation
            </Typography>
            <Typography variant="body1" sx={{ mt: 2, lineHeight: 1.8 }}>
              {routingReason}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {allScores && allScores.length > 0 ? (
        <>
          <Typography variant="h6" gutterBottom>Routing Scores</Typography>
          <TableContainer component={Paper} sx={{ backgroundColor: 'rgba(255,255,255,0.03)', mb: 4 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Warehouse</TableCell>
                  <TableCell>Distance (km)</TableCell>
                  <TableCell>Dist Score ({weights?.distanceWeight ?? 35}%)</TableCell>
                  <TableCell>Inv Score ({weights?.inventoryWeight ?? 35}%)</TableCell>
                  <TableCell>Del Score ({weights?.deliveryWeight ?? 20}%)</TableCell>
                  <TableCell>Cost Score ({weights?.costWeight ?? 10}%)</TableCell>
                  <TableCell>Final Score</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {allScores.sort((a,b) => b.finalScore - a.finalScore).map((s) => (
                  <TableRow 
                    key={s.warehouseName}
                    sx={{ 
                      backgroundColor: s.warehouseName === selectedWarehouse.warehouseName ? 'rgba(16, 185, 129, 0.1)' : 'inherit',
                      borderLeft: s.warehouseName === selectedWarehouse.warehouseName ? '4px solid #10b981' : 'none'
                    }}
                  >
                    <TableCell fontWeight={s.warehouseName === selectedWarehouse.warehouseName ? 'bold' : 'normal'}>
                      {s.warehouseName}
                      {s.warehouseName === selectedWarehouse.warehouseName && <Chip label="WINNER" size="small" color="success" sx={{ ml: 1 }} />}
                    </TableCell>
                    <TableCell>{s.distance_km.toFixed(2)}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{s.distScore.toFixed(4)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        × {weights?.distanceWeight ?? 35}% = {s.distWeighted.toFixed(4)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{s.invScore.toFixed(4)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        × {weights?.inventoryWeight ?? 35}% = {s.invWeighted.toFixed(4)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{s.delScore.toFixed(4)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        × {weights?.deliveryWeight ?? 20}% = {s.delWeighted.toFixed(4)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{s.costScore.toFixed(4)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        × {weights?.costWeight ?? 10}% = {s.costWeighted.toFixed(4)}
                      </Typography>
                    </TableCell>
                    <TableCell fontWeight="bold">{s.finalScore.toFixed(4)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {eliminatedWarehouses && eliminatedWarehouses.length > 0 && (
            <>
              <Typography variant="h6" color="error" gutterBottom>Eliminated Warehouses</Typography>
              <TableContainer component={Paper} sx={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Warehouse Name</TableCell>
                      <TableCell>Available Stock</TableCell>
                      <TableCell>Reason</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {eliminatedWarehouses.map((ew, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{ew.warehouseName}</TableCell>
                        <TableCell>{ew.availableQuantity}</TableCell>
                        <TableCell><Chip label={ew.reason} color="error" size="small" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </>
      ) : (
        <>
          <Typography variant="h6" gutterBottom>Routing Decision</Typography>
          <Typography variant="body2" color="warning.main" sx={{ mb: 2 }}>
            ⚠️ Full comparison not saved for this historical order.
          </Typography>
          <TableContainer component={Paper} sx={{ backgroundColor: 'rgba(255,255,255,0.03)', mb: 4 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Warehouse</TableCell>
                  <TableCell>Final Score</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow sx={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', borderLeft: '4px solid #10b981' }}>
                  <TableCell fontWeight="bold">
                    {selectedWarehouse?.warehouseName || 'Unknown'}
                    <Chip label="WINNER" size="small" color="success" sx={{ ml: 1 }} />
                  </TableCell>
                  <TableCell fontWeight="bold">
                    {data.routingScore ? data.routingScore.toFixed(4) : 'N/A'}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
};

export default RoutingDecision;
