/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShoppingBag, ShieldCheck, ThermometerSnowflake, Droplets, LogIn, LogOut, User, Star } from 'lucide-react';
import heroImg from './assets/images/blue_cooling_mat_xl_1782768048236.jpg';
import detailImg from './assets/images/mat_material_detail_1782768061973.jpg';
import dogImg from './assets/images/dog_on_mat_sofa_1782768073896.jpg';
import matSizeImg from './assets/images/mat_large_dog_dimensions_1782806512669.jpg';
import coolingFeaturesImg from './assets/images/cooling_mat_features_1782809077134.jpg';
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, db } from './firebase';
import { doc, setDoc, collection, getDocs, orderBy, query } from 'firebase/firestore';

const productImages = [coolingFeaturesImg, heroImg, dogImg, matSizeImg];

const testimonials = [
  { id: 1, text: "Helt fantastisk! Max ligger på den hele dagen. Den kjøler utrolig godt uten å være våt.", author: "Kari & Max", rating: 5 },
  { id: 2, text: "Beste kjøpet i sommer. Luna pleide å pese hele natten, nå sover hun rolig på matten sin.", author: "Thomas & Luna", rating: 5 },
  { id: 3, text: "Veldig god kvalitet. Har hatt billigere varianter før, men denne er i en helt annen liga.", author: "Silje & Leo", rating: 5 },
  { id: 4, text: "Perfekt størrelse for vår Golden Retriever. Han elsker den!", author: "Anders & Charlie", rating: 5 },
  { id: 5, text: "Rask levering og produktet fungerer akkurat som beskrevet. Anbefales på det sterkeste.", author: "Marita & Bella", rating: 5 },
  { id: 6, text: "Gjør bilreisene om sommeren mye mer behagelige for hunden vår.", author: "Petter & Milo", rating: 5 },
  { id: 7, text: "Solid materiale som tåler klørne til en aktiv valp. Imponerende byggekvalitet.", author: "Hanne & Kira", rating: 5 },
  { id: 8, text: "Endelig noe som faktisk fungerer. Kjøler umiddelbart når han legger seg.", author: "Ole & Balder", rating: 5 }
];

export default function App() {
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isAdminRoute, setIsAdminRoute] = useState(false);

  useEffect(() => {
    setIsAdminRoute(window.location.pathname === '/admin');

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % productImages.length);
    }, 4000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true' && params.get('session_id')) {
      const sessionId = params.get('session_id');
      verifyAndSaveOrder(sessionId!);
    }
  }, []);

  const verifyAndSaveOrder = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/verify-session?session_id=${sessionId}`);
      const session = await res.json();
      
      if (session.payment_status === 'paid') {
        const orderData = {
          id: session.id,
          amount_total: session.amount_total,
          customer_details: session.customer_details,
          shipping_details: session.shipping_details,
          created_at: new Date().toISOString(),
          status: 'paid'
        };

        // Save to Firestore
        await setDoc(doc(db, 'orders', session.id), orderData);
        
        // Send email via backend
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderDetails: orderData })
        });

        setShowSuccessModal(true);
        // Clear URL parameters
        window.history.replaceState({}, document.title, "/");
      }
    } catch (error) {
      console.error("Error saving order:", error);
    }
  };
  
  const handleCheckout = async () => {
    setLoadingCheckout(true);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (data.url) {
        if (window.self !== window.top) {
          // In iframe (AI Studio preview) Stripe Checkout is blocked, so we open in a new tab
          window.open(data.url, '_blank');
          // Optional fallback message in case popup blocker blocks it
          alert("Stripe Checkout blokkeres inne i forhåndsvisningen. Betalingsvinduet er åpnet i en ny fane! Hvis det ble blokkert, vennligst åpne appen i en ny fane (øverst til høyre) for å kjøpe.");
        } else {
          window.location.href = data.url;
        }
      } else {
        alert(data.error || 'En feil oppstod. Prøv igjen.');
      }
    } catch (error) {
      console.error(error);
      alert('En feil oppstod. Prøv igjen.');
    } finally {
      setLoadingCheckout(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Feil ved innlogging:", error);
      alert('Innlogging feilet. Prøv igjen.');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Feil ved utlogging:", error);
    }
  };

  if (isAdminRoute) {
    return <AdminPanel user={user} onLogin={handleGoogleLogin} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd] text-[#1d1d1f] font-sans selection:bg-blue-200">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 h-14 bg-white/80 backdrop-blur-md z-50 border-b border-gray-200/50 flex items-center px-4 md:px-8">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <span className="font-semibold tracking-tight text-lg">Kjølematte.</span>
          <div className="flex gap-4 items-center">
            {user ? (
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium flex items-center gap-2">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profil" className="w-6 h-6 rounded-full" />
                  ) : (
                    <User size={16} />
                  )}
                  {user.displayName?.split(' ')[0]}
                </span>
                <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1" title="Logg ut">
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button onClick={handleGoogleLogin} className="text-sm font-medium hover:text-blue-600 transition-colors flex items-center gap-2">
                <LogIn size={16} />
                Logg inn
              </button>
            )}
            <button onClick={handleCheckout} className="bg-black text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-gray-800 transition-colors">
              Kjøp nå
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-bold tracking-tighter mb-6"
          >
            Kjølematte.
            <br />
            <span className="text-gray-400">Perfeksjon for din beste venn.</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl md:text-2xl text-gray-500 max-w-2xl mx-auto mb-10 font-medium"
          >
            Hold hunden din avkjølt på varme sommerdager med vår premium kjølematte. Designet med avansert termisk teknologi og skandinavisk minimalisme.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col items-center gap-4 mb-16"
          >
            <p className="text-2xl font-semibold">kr 399,-</p>
            <button 
              onClick={handleCheckout}
              disabled={loadingCheckout}
              className="bg-[#0071e3] text-white px-8 py-3 rounded-full text-lg font-medium hover:bg-[#0077ed] transition-colors flex items-center gap-2 disabled:opacity-70"
            >
              {loadingCheckout ? 'Laster...' : (
                <>
                  <ShoppingBag size={20} />
                  Kjøp med kort eller Vipps
                </>
              )}
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
            className="relative max-w-5xl mx-auto rounded-[2rem] overflow-hidden shadow-2xl aspect-[4/3] md:aspect-[16/9] group"
          >
            {productImages.map((img, idx) => (
              <motion.img 
                key={idx}
                src={img} 
                alt={`Premium Dog Cooling Mat ${idx + 1}`} 
                initial={{ opacity: 0 }}
                animate={{ opacity: currentImageIndex === idx ? 1 : 0 }}
                transition={{ duration: 1 }}
                className={`absolute inset-0 w-full h-full bg-white transition-transform duration-700 group-hover:scale-105 ${img === matSizeImg || img === coolingFeaturesImg ? 'object-contain p-4 md:p-8' : 'object-cover'}`} 
                referrerPolicy="no-referrer" 
              />
            ))}
          </motion.div>
        </div>
      </main>

      {/* Features Section */}
      <section className="py-32 bg-white px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-12 text-center">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                <ThermometerSnowflake size={32} />
              </div>
              <h3 className="text-xl font-semibold mb-3">Avansert Kjøleteknologi</h3>
              <p className="text-gray-500">Kjølegelen aktiveres ved trykk. Krever ingen frysing eller strøm. Kjøler umiddelbart når hunden legger seg.</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-gray-50 text-gray-900 rounded-2xl flex items-center justify-center mb-6">
                <ShieldCheck size={32} />
              </div>
              <h3 className="text-xl font-semibold mb-3">Premium Materialer</h3>
              <p className="text-gray-500">Laget av ripebestandig, giftfri PVC av medisinsk kvalitet. Trygg for hunden og bygget for å vare sesong etter sesong.</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mb-6">
                <Droplets size={32} />
              </div>
              <h3 className="text-xl font-semibold mb-3">Enkel å rengjøre</h3>
              <p className="text-gray-500">Den vannavstøtende overflaten tørkes enkelt av med en fuktig klut. Alltid ren og klar til bruk.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Detail Image Section */}
      <section className="py-20 px-4 bg-black text-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
          <div className="md:w-1/2">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Designet ned til minste detalj.</h2>
            <p className="text-xl text-gray-400 mb-8">Hver søm og hvert materiale er nøye utvalgt for å gi maksimal komfort og kjøleeffekt for din hund.</p>
            <ul className="space-y-4 text-gray-300 text-lg">
              <li className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-white"></div> Pustende struktur</li>
              <li className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-white"></div> Sklisikker underside</li>
              <li className="flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-white"></div> Forsterkede kanter</li>
            </ul>
          </div>
          <div className="md:w-1/2 rounded-[2rem] overflow-hidden group shadow-2xl shadow-black/50 border border-gray-800">
            <img src={detailImg} alt="Kjølematte detaljer" className="w-full h-auto bg-gray-900 transition-transform duration-700 group-hover:scale-105" referrerPolicy="no-referrer" />
          </div>
        </div>
      </section>
      
      {/* Testimonials Section */}
      <section className="py-24 bg-[#fbfbfd] px-4 overflow-hidden flex flex-col items-center">
        <div className="max-w-7xl mx-auto w-full">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-center mb-16">Hva kundene våre sier.</h2>
        </div>
          
        <div className="flex w-full overflow-hidden whitespace-nowrap">
          <div className="flex animate-marquee hover:[animation-play-state:paused] w-max">
            {/* Group 1 */}
            <div className="flex gap-6 pr-6">
              {testimonials.map((testimonial) => (
                <div 
                  key={`g1-${testimonial.id}`} 
                  className="shrink-0 w-[85vw] md:w-[350px] whitespace-normal bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex gap-1 mb-4 text-yellow-400">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} size={16} fill="currentColor" />
                      ))}
                    </div>
                    <p className="text-gray-800 text-lg font-medium leading-relaxed mb-6">"{testimonial.text}"</p>
                  </div>
                  <p className="text-gray-500 font-medium">{testimonial.author}</p>
                </div>
              ))}
            </div>
            {/* Group 2 */}
            <div className="flex gap-6 pr-6">
              {testimonials.map((testimonial) => (
                <div 
                  key={`g2-${testimonial.id}`} 
                  className="shrink-0 w-[85vw] md:w-[350px] whitespace-normal bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex gap-1 mb-4 text-yellow-400">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} size={16} fill="currentColor" />
                      ))}
                    </div>
                    <p className="text-gray-800 text-lg font-medium leading-relaxed mb-6">"{testimonial.text}"</p>
                  </div>
                  <p className="text-gray-500 font-medium">{testimonial.author}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 text-center text-gray-500 text-sm">
        <p>© {new Date().getFullYear()} Kjølematte. Alle rettigheter reservert.</p>
        <a href="/admin" className="text-gray-400 hover:text-gray-600 mt-2 inline-block">Admin</a>
      </footer>

      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-4">Takk for bestillingen!</h3>
            <p className="text-gray-600 mb-8">Vi har mottatt din bestilling og sender den så fort som mulig. En bekreftelse er sendt til din e-post.</p>
            <button 
              onClick={() => setShowSuccessModal(false)}
              className="bg-black text-white w-full py-3 rounded-full font-medium hover:bg-gray-800 transition-colors"
            >
              Lukk
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminPanel({ user, onLogin, onLogout }: { user: any, onLogin: () => void, onLogout: () => void }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  const fetchOrders = async () => {
    try {
      const q = query(collection(db, 'orders'), orderBy('created_at', 'desc'));
      const querySnapshot = await getDocs(q);
      const ordersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(ordersData);
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-lg max-w-md w-full text-center">
          <h2 className="text-2xl font-bold mb-6">Admin Login</h2>
          <button onClick={onLogin} className="bg-black text-white px-6 py-3 rounded-full w-full font-medium flex items-center justify-center gap-2">
            <LogIn size={20} /> Logg inn med Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Ordreoversikt</h1>
          <div className="flex items-center gap-4">
            <a href="/" className="text-blue-600 hover:underline text-sm font-medium">Tilbake til butikk</a>
            <button onClick={onLogout} className="text-sm font-medium text-gray-600 hover:text-black">Logg ut</button>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Laster ordrer...</div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center text-gray-500">Ingen ordrer enda.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500 uppercase tracking-wider">
                    <th className="p-4 font-medium">Dato</th>
                    <th className="p-4 font-medium">Kunde</th>
                    <th className="p-4 font-medium">Adresse</th>
                    <th className="p-4 font-medium">Beløp</th>
                    <th className="p-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orders.map(order => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="p-4 text-sm whitespace-nowrap">
                        {new Date(order.created_at).toLocaleDateString('no-NO')}
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-gray-900">{order.customer_details?.name}</div>
                        <div className="text-sm text-gray-500">{order.customer_details?.email}</div>
                        <div className="text-sm text-gray-500">{order.customer_details?.phone}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-gray-900">{order.shipping_details?.address?.line1}</div>
                        <div className="text-sm text-gray-500">{order.shipping_details?.address?.postal_code} {order.shipping_details?.address?.city}</div>
                      </td>
                      <td className="p-4 font-medium">
                        {(order.amount_total / 100).toFixed(2)} NOK
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
