import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip, Grid, TextField, MenuItem, Card, CardContent } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

const OrderManagement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  
  const [formData, setFormData] = useState({
    customerName: '', customerLatitude: '', customerLongitude: '', productId: '', quantity: ''
  });
  const [loadingRandom, setLoadingRandom] = useState(false);

  const fetchOrders = async () => {
    try {
      const res = await api.get('/orders');
      setOrders(res.data.data.reverse()); // latest first
    } catch (err) { console.error(err); }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products');
      setProducts(res.data.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchOrders();
    fetchProducts();

    const interval = setInterval(() => {
      fetchOrders();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    
    console.log("Form State Values:", formData);
    
    if (!formData.customerName || !formData.customerLatitude || !formData.customerLongitude || !formData.productId || !formData.quantity) {
      alert("Missing required fields");
      return;
    }

    try {
      const payload = {
        customerName: formData.customerName,
        customerLat: parseFloat(formData.customerLatitude),
        customerLng: parseFloat(formData.customerLongitude),
        productId: formData.productId,
        quantity: parseInt(formData.quantity)
      };
      const res = await api.post('/routing/route-order', payload);
      if (res.data.success) {
        // Navigate to Routing Decision Page with state
        navigate('/routing-decision', { state: res.data.data });
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error placing order');
    }
  };

  const handleGenerateRandomOrder = async () => {
    setLoadingRandom(true);
    try {
      const res = await api.post('/orders/generate-random');
      if (res.data.success) {
        navigate('/routing-decision', { state: res.data.data });
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error generating random order');
    } finally {
      setLoadingRandom(false);
    }
  };

  const markFulfilled = async (id) => {
    try {
      await api.put(`/orders/${id}`, { status: 'fulfilled' });
      fetchOrders();
    } catch (err) { console.error(err); }
  };

  const getStatusColor = (status) => {
    if (status === 'pending') return 'default';
    if (status === 'assigned') return 'info';
    if (status === 'fulfilled') return 'success';
    return 'default';
  };

  return (
    <Box>
      <Typography variant="h4" color="text.primary" fontWeight="bold" gutterBottom>
        Order Management
      </Typography>

      {user.role==='admin' && (<Card sx={{ mb: 4, mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Place New Order</Typography>
          <form onSubmit={handlePlaceOrder}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Customer Name" required
                  value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField select fullWidth label="Product" required
                  value={formData.productId} onChange={e => setFormData({...formData, productId: e.target.value})}>
                  {products.map(p => (
                    <MenuItem key={p._id} value={p._id}>{p.productName} ({p.sku})</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth label="Customer Latitude" type="number" inputProps={{ step: "any" }} required
                  value={formData.customerLatitude} onChange={e => setFormData({...formData, customerLatitude: e.target.value})} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth label="Customer Longitude" type="number" inputProps={{ step: "any" }} required
                  value={formData.customerLongitude} onChange={e => setFormData({...formData, customerLongitude: e.target.value})} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField fullWidth label="Quantity" type="number" required
                  value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} />
              </Grid>
            </Grid>
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button 
                variant="outlined" 
                color="primary" 
                size="large" 
                onClick={handleGenerateRandomOrder}
                disabled={loadingRandom}
              >
                {loadingRandom ? 'Generating...' : '🎲 Generate Random Order'}
              </Button>
              <Button type="submit" variant="contained" color="secondary" size="large">
                Route Order
              </Button>
            </Box>
          </form>
        </CardContent>
      </Card>)}

      <Typography variant="h6" gutterBottom>All Orders</Typography>
      <TableContainer component={Paper} sx={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Customer</TableCell>
              <TableCell>Product</TableCell>
              <TableCell>Qty</TableCell>
              <TableCell>Assigned Warehouse</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.map((o) => (
              <TableRow key={o._id}>
                <TableCell>{o.customerName}</TableCell>
                <TableCell>{o.productId?.productName}</TableCell>
                <TableCell>{o.quantity}</TableCell>
                <TableCell>{o.assignedWarehouseId?.warehouseName || 'N/A'}</TableCell>
                <TableCell>
                  <Chip label={o.status.toUpperCase()} color={getStatusColor(o.status)} size="small" />
                </TableCell>
                <TableCell align="right">
                  {o.status === 'assigned' && (user.role === 'manager' || user.role === 'admin') && (
                    <Button size="small" color="success" onClick={() => markFulfilled(o._id)}>
                      Mark Fulfilled
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default OrderManagement;
