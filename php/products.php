<?php
// php/products.php
require 'db.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['delete_id'])) {
    $stmt = $pdo->prepare("DELETE FROM products WHERE id = ?");
    $stmt->execute([$_POST['delete_id']]);
    header("Location: products.php");
    exit;
}

$stmt = $pdo->query("SELECT p.*, prof.business_name FROM products p LEFT JOIN profiles prof ON p.profile_id = prof.id ORDER BY p.created_at DESC");
$products = $stmt->fetchAll();
?>
<!DOCTYPE html>
<html>
<head>
    <title>Admin - Products</title>
    <style>
        body { font-family: sans-serif; margin: 0; padding: 20px; background: #f8fafc; }
        .navbar { display: flex; gap: 20px; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #ccc; }
        .navbar a { text-decoration: none; color: #10b981; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; background: white; margin-top: 20px; }
        th, td { padding: 12px; border: 1px solid #ddd; text-align: left; }
        th { background: #f1f5f9; }
        .btn-danger { background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
    </style>
</head>
<body>
    <div class="navbar">
        <a href="index.php">Sellers</a>
        <a href="products.php">Products</a>
    </div>

    <h1>Product Moderation</h1>
    <table>
        <tr>
            <th>Name</th>
            <th>Seller</th>
            <th>Price</th>
            <th>Stock</th>
            <th>Action</th>
        </tr>
        <?php foreach ($products as $product): ?>
        <tr>
            <td><?= htmlspecialchars($product['name'] ?? 'N/A') ?></td>
            <td><?= htmlspecialchars($product['business_name'] ?? 'N/A') ?></td>
            <td>$<?= htmlspecialchars($product['price'] ?? '0') ?></td>
            <td><?= htmlspecialchars($product['stock'] ?? '0') ?></td>
            <td>
                <form method="POST" style="margin:0;">
                    <input type="hidden" name="delete_id" value="<?= htmlspecialchars($product['id']) ?>">
                    <button type="submit" class="btn-danger" onclick="return confirm('Are you sure you want to delete this product?');">Delete</button>
                </form>
            </td>
        </tr>
        <?php endforeach; ?>
    </table>
</body>
</html>
