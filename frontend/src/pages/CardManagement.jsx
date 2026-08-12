import { useEffect, useState } from "react";
import { Plus, Trash2, Shield, User, Search, RefreshCw } from "lucide-react";
import api from "../services/api";

export default function CardManagement() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  
  // Form states
  const [newUid, setNewUid] = useState("");
  const [newType, setNewType] = useState("GUEST");
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  const fetchCards = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/cards");
      setCards(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Không thể tải danh sách thẻ");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCard = async (e) => {
    e.preventDefault();
    if (!newUid.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      await api.post("/cards", {
        uid: newUid.trim().toUpperCase(),
        type: newType,
      });
      setNewUid("");
      setNewType("GUEST");
      fetchCards();
    } catch (err) {
      setError(err.response?.data?.message || "Không thể tạo thẻ mới");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCard = async (uid) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa thẻ UID ${uid}?`)) return;
    setError("");
    try {
      await api.delete(`/cards/${uid}`);
      fetchCards();
    } catch (err) {
      setError(err.response?.data?.message || "Không thể xóa thẻ");
    }
  };

  useEffect(() => {
    fetchCards();
  }, []);

  const filteredCards = cards.filter((card) =>
    card.uid.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Quản lý thẻ</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Đăng ký và quản lý thẻ RFID (VIP & Guest)
          </p>
        </div>
        <button
          onClick={fetchCards}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold rounded-lg transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Làm mới
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3.5 py-2.5 rounded-lg">
          ⚠️ {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Register Card Form */}
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 shadow-sm h-fit">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            Đăng ký thẻ RFID mới
          </h3>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Nhập mã thẻ RFID chính xác để cho phép truy cập.
          </p>

          <form onSubmit={handleCreateCard} className="flex flex-col gap-4 mt-2">
            <div>
              <label htmlFor="uid" className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Mã thẻ (UID)
              </label>
              <input
                id="uid"
                type="text"
                required
                placeholder="Nhập mã hex (vd: 39B21405)"
                value={newUid}
                onChange={(e) => setNewUid(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-input-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
              />
            </div>

            <div>
              <label htmlFor="type" className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Loại thẻ (Card Type)
              </label>
              <select
                id="card-type"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-input-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
              >
                <option value="GUEST">Guest (Khách vãng lai)</option>
                <option value="VIP">VIP (Thành viên)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-10 mt-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-sky-400 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 shadow-sm"
            >
              {submitting ? "Đang xử lý..." : "Lưu thẻ"}
            </button>
          </form>
        </div>

        {/* Card Table View */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl px-6 py-5 flex flex-col shadow-sm">
          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 className="text-sm font-bold text-foreground">
              Danh sách thẻ ({filteredCards.length})
            </h3>
            
            {/* Search Input */}
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Tìm kiếm UID thẻ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 rounded-lg bg-secondary border border-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground uppercase tracking-wider font-semibold bg-slate-50">
                    <th className="py-3 px-4">UID</th>
                    <th className="py-3 px-4">Loại</th>
                    <th className="py-3 px-4">Ngày đăng ký</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {filteredCards.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-muted-foreground">
                        {loading ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                            <span className="text-xs">Đang tải...</span>
                          </div>
                        ) : (
                          "Không tìm thấy thẻ nào."
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredCards.map((card) => (
                      <tr key={card.uid} className="hover:bg-secondary/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium tracking-wide">{card.uid}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            card.type === "VIP"
                              ? "bg-purple-50 text-purple-600 border border-purple-200"
                              : "bg-blue-50 text-blue-600 border border-blue-200"
                          }`}>
                            {card.type === "VIP" ? (
                              <Shield className="w-3 h-3 text-purple-500" />
                            ) : (
                              <User className="w-3 h-3 text-blue-500" />
                            )}
                            {card.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {card.createdAt ? new Date(card.createdAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDeleteCard(card.uid)}
                            className="p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-400 rounded-md transition-colors cursor-pointer"
                            title="Xóa thẻ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
