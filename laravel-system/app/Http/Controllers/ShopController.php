<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\Ebook;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Http\Request;

class ShopController extends Controller
{
    public function products()
    {
        $products = Product::latest()->get();
        $branches = Branch::where('status', 'active')->get();
        return view('shop.products', compact('products', 'branches'));
    }

    public function ebooks()
    {
        $ebooks = Ebook::latest()->get();
        return view('shop.ebooks', compact('ebooks'));
    }

    public function placeOrder(Request $request)
    {
        $data = $request->validate([
            'product_id' => 'required|exists:products,id',
            'quantity' => 'required|integer|min:1|max:20',
            'phone' => 'required|string|max:40',
            'delivery_address' => 'required|string|max:300',
            'branch_pickup_id' => 'nullable|exists:branches,id',
        ]);

        $product = Product::findOrFail($data['product_id']);
        if ($product->stock < $data['quantity']) {
            return back()->withErrors(['order' => "Insufficient stock for {$product->title}."]);
        }

        $deliveryFee = empty($data['branch_pickup_id']) ? 50 : 0;
        $total = ($product->price * $data['quantity']) + $deliveryFee;

        Order::create([
            'user_id' => $request->user()->id,
            'phone' => $data['phone'],
            'delivery_address' => $data['delivery_address'],
            'branch_pickup_id' => $data['branch_pickup_id'] ?? null,
            'items' => [['title' => $product->title, 'qty' => $data['quantity'], 'price' => $product->price]],
            'delivery_fee' => $deliveryFee,
            'total_amount' => $total,
        ]);

        $product->decrement('stock', $data['quantity']);

        return back()->with('status', 'Order placed successfully!');
    }

    public function claimEbook(Ebook $ebook)
    {
        return back()->with('status', "E-Book '{$ebook->title}' unlocked in your library!");
    }
}
