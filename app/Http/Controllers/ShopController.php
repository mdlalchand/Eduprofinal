<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\Ebook;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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

        $order = DB::transaction(function () use ($data, $request) {
            $product = Product::whereKey($data['product_id'])->lockForUpdate()->firstOrFail();
            if ($product->stock < $data['quantity']) {
                return null;
            }

            $deliveryFee = empty($data['branch_pickup_id']) ? 50 : 0;
            $total = ($product->price * $data['quantity']) + $deliveryFee;

            $order = Order::create([
                'user_id' => $request->user()->id,
                'phone' => $data['phone'],
                'delivery_address' => $data['delivery_address'],
                'branch_pickup_id' => $data['branch_pickup_id'] ?? null,
                'items' => [['title' => $product->title, 'qty' => $data['quantity'], 'price' => $product->price]],
                'delivery_fee' => $deliveryFee,
                'total_amount' => $total,
            ]);

            $product->decrement('stock', $data['quantity']);
            return $order;
        });

        if (!$order) {
            return back()->withErrors(['order' => 'Insufficient stock for this order.']);
        }

        return back()->with('status', 'Order placed successfully and is awaiting payment/order confirmation.');
    }

    public function claimEbook(Request $request, Ebook $ebook)
    {
        if (!$ebook->is_free && $ebook->price > 0) {
            return back()->withErrors([
                'ebook' => "Paid E-Book '{$ebook->title}' cannot be unlocked by submitting a transaction ID. Verified checkout is not enabled for paid e-books yet.",
            ]);
        }

        $request->user()->ebooks()->syncWithoutDetaching([$ebook->id]);

        return back()->with('status', "Free E-Book '{$ebook->title}' added to your library.");
    }
}
