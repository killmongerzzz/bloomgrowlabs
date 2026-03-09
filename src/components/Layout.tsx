import { Search, Bell, LayoutDashboard, Search as SearchIcon, PenTool, Image as ImageIcon, Megaphone, BarChart, Settings2, Settings } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';

const navigation = [
    { name: 'Dashboard', to: '/', icon: LayoutDashboard },
    { name: 'Research', to: '/research', icon: SearchIcon },
    { name: 'Copy Generator', to: '/copy', icon: PenTool },
    { name: 'Creative Studio', to: '/creatives', icon: ImageIcon },
    { name: 'Campaign Manager', to: '/campaigns', icon: Megaphone },
    { name: 'Analytics', to: '/analytics', icon: BarChart },
    { name: 'Automation Rules', to: '/automation', icon: Settings2 },
    { name: 'Settings', to: '/settings', icon: Settings },
];

export default function Layout() {
    return (
        <div className="flex h-screen bg-gray-50 text-gray-900">
            {/* Sidebar */}
            <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
                <div className="h-16 flex items-center px-6 border-b border-gray-200">
                    <div className="flex items-center gap-2 font-bold text-lg text-primary-500">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                            B
                        </div>
                        BloomGrow OS
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto py-4">
                    <nav className="flex flex-col gap-1 px-3">
                        {navigation.map((item) => (
                            <NavLink
                                key={item.name}
                                to={item.to}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive
                                        ? 'bg-indigo-50 text-indigo-700 font-medium'
                                        : 'text-gray-600 hover:bg-gray-100'
                                    }`
                                }
                            >
                                <item.icon className="w-5 h-5" />
                                {item.name}
                            </NavLink>
                        ))}
                    </nav>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Header */}
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
                    <div className="flex items-center gap-4 flex-1">
                        <div className="relative w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search experiments, ad copy..."
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                            <Bell className="w-5 h-5" />
                        </button>
                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-medium border border-indigo-200">
                            U
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-8 bg-gray-50">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
